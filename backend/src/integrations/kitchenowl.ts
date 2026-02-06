import axios, { AxiosInstance } from 'axios';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import { IntegrationConfig, IntegrationData, KitchenOwlConfig } from '../types';
import { logger } from '../services/logger';

interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCache>();

export class KitchenOwlIntegration extends BaseIntegration {
  readonly type = 'kitchenowl';
  readonly name = 'KitchenOwl';

  private getConfigKey(config: KitchenOwlConfig): string {
    return `ko_${config.host}_${config.username}`;
  }

  private getBaseUrl(config: KitchenOwlConfig): string {
    const protocol = config.verifySSL === false ? 'http' : 'https';
    const port = config.port || 443;
    const portSuffix = (port === 443 || port === 80) ? '' : `:${port}`;
    return `${protocol}://${config.host}${portSuffix}`;
  }

  private async getAccessToken(config: KitchenOwlConfig): Promise<string> {
    const configKey = this.getConfigKey(config);
    const cached = tokenCache.get(configKey);

    // Return cached token if still valid (with 60s buffer)
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    // Try to refresh if we have a refresh token
    if (cached?.refreshToken) {
      try {
        const refreshed = await this.refreshToken(config, cached.refreshToken);
        if (refreshed) {
          return refreshed;
        }
      } catch (error) {
        logger.debug('kitchenowl', 'Token refresh failed, re-authenticating');
      }
    }

    // Authenticate with username/password
    return this.authenticate(config);
  }

  private async authenticate(config: KitchenOwlConfig): Promise<string> {
    const baseUrl = this.getBaseUrl(config);

    const response = await axios.post(
      `${baseUrl}/api/auth`,
      {
        username: config.username,
        password: config.password,
        device: 'Dash Dashboard',
      },
      {
        httpsAgent: config.verifySSL === false
          ? new (require('https').Agent)({ rejectUnauthorized: false })
          : undefined,
        timeout: 10000,
      }
    );

    const { access_token, refresh_token } = response.data;

    // JWT tokens typically expire in 15 minutes
    const expiresAt = Date.now() + 14 * 60 * 1000;

    tokenCache.set(this.getConfigKey(config), {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    });

    return access_token;
  }

  private async refreshToken(config: KitchenOwlConfig, refreshToken: string): Promise<string | null> {
    const baseUrl = this.getBaseUrl(config);

    try {
      const response = await axios.get(`${baseUrl}/api/auth/refresh`, {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
        httpsAgent: config.verifySSL === false
          ? new (require('https').Agent)({ rejectUnauthorized: false })
          : undefined,
        timeout: 10000,
      });

      const { access_token, refresh_token } = response.data;
      const expiresAt = Date.now() + 14 * 60 * 1000;

      tokenCache.set(this.getConfigKey(config), {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken,
        expiresAt,
      });

      return access_token;
    } catch {
      return null;
    }
  }

  private async createClient(config: KitchenOwlConfig): Promise<AxiosInstance> {
    const token = await this.getAccessToken(config);
    const baseUrl = this.getBaseUrl(config);

    return axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      httpsAgent: config.verifySSL === false
        ? new (require('https').Agent)({ rejectUnauthorized: false })
        : undefined,
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const koConfig = config as KitchenOwlConfig;

    if (!koConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!koConfig.username) {
      return { success: false, message: 'Username is required' };
    }
    if (!koConfig.password) {
      return { success: false, message: 'Password is required' };
    }

    try {
      // Clear any cached token
      tokenCache.delete(this.getConfigKey(koConfig));

      const client = await this.createClient(koConfig);

      // Get user info
      const userResponse = await client.get('/api/user');
      const user = userResponse.data;

      // Get households
      const householdsResponse = await client.get('/api/household');
      const households = householdsResponse.data || [];

      return {
        success: true,
        message: `Connected as ${user.name || user.username} (${households.length} household${households.length !== 1 ? 's' : ''})`,
        details: {
          username: user.username,
          name: user.name,
          householdCount: households.length,
        },
      };
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status?: number; data?: { message?: string } };
        code?: string;
      };

      logger.error('kitchenowl', 'Connection test failed', { error: err.message });

      if (err.response?.status === 401) {
        return { success: false, message: 'Invalid username or password' };
      }
      if (err.code === 'ECONNREFUSED') {
        return { success: false, message: 'Connection refused. Check host and port.' };
      }
      if (err.code === 'ENOTFOUND') {
        return { success: false, message: 'Host not found. Check the hostname.' };
      }

      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const koConfig = config as KitchenOwlConfig;
    const client = await this.createClient(koConfig);
    const householdId = koConfig.householdId || 1;

    switch (metric) {
      case 'shopping-list':
        return this.getShoppingList(client, householdId);
      case 'recipes':
        return this.getRecipes(client, householdId);
      case 'meal-plan':
        return this.getMealPlan(client, householdId);
      case 'expenses':
        return this.getExpenses(client, householdId);
      case 'household':
        return this.getHousehold(client, householdId);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getShoppingList(client: AxiosInstance, householdId: number): Promise<IntegrationData> {
    // Get all shopping lists
    const listsResponse = await client.get(`/api/household/${householdId}/shoppinglist`);
    const lists = listsResponse.data || [];

    // Get items for each list
    const listsWithItems = await Promise.all(
      lists.map(async (list: { id: number; name: string }) => {
        try {
          const itemsResponse = await client.get(
            `/api/household/${householdId}/shoppinglist/${list.id}/items`
          );
          const items = itemsResponse.data || [];
          return {
            id: list.id,
            name: list.name,
            items: items.map((item: { id: number; name: string; description?: string; done?: boolean }) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              done: item.done || false,
            })),
            itemCount: items.length,
            doneCount: items.filter((i: { done?: boolean }) => i.done).length,
          };
        } catch {
          return {
            id: list.id,
            name: list.name,
            items: [],
            itemCount: 0,
            doneCount: 0,
          };
        }
      })
    );

    const totalItems = listsWithItems.reduce((sum, list) => sum + list.itemCount, 0);
    const totalDone = listsWithItems.reduce((sum, list) => sum + list.doneCount, 0);

    return {
      lists: listsWithItems,
      summary: {
        listCount: lists.length,
        totalItems,
        totalDone,
        totalPending: totalItems - totalDone,
      },
    };
  }

  private async getRecipes(client: AxiosInstance, householdId: number): Promise<IntegrationData> {
    const response = await client.get(`/api/household/${householdId}/recipe`);
    const recipes = response.data || [];

    // Get tags
    let tags: Array<{ id: number; name: string }> = [];
    try {
      const tagsResponse = await client.get(`/api/household/${householdId}/tag`);
      tags = tagsResponse.data || [];
    } catch {
      // Tags endpoint may not exist in older versions
    }

    const formattedRecipes = recipes.map((recipe: {
      id: number;
      name: string;
      description?: string;
      time?: number;
      cook_time?: number;
      prep_time?: number;
      yields?: number;
      yields_unit?: string;
      source?: string;
      photo?: string;
      tags?: Array<{ id: number; name: string }>;
      created_at?: string;
      updated_at?: string;
    }) => ({
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      time: recipe.time,
      cookTime: recipe.cook_time,
      prepTime: recipe.prep_time,
      yields: recipe.yields,
      yieldsUnit: recipe.yields_unit,
      source: recipe.source,
      photo: recipe.photo,
      tags: recipe.tags?.map(t => t.name) || [],
      createdAt: recipe.created_at,
      updatedAt: recipe.updated_at,
    }));

    // Sort by most recently updated
    formattedRecipes.sort((a: { updatedAt?: string }, b: { updatedAt?: string }) => {
      if (!a.updatedAt || !b.updatedAt) return 0;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return {
      recipes: formattedRecipes.slice(0, 50), // Limit to 50 recipes
      tags,
      summary: {
        recipeCount: recipes.length,
        tagCount: tags.length,
      },
    };
  }

  private async getMealPlan(client: AxiosInstance, householdId: number): Promise<IntegrationData> {
    // Get meal plan for the next 14 days
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    const startDate = today.toISOString().split('T')[0];
    const endDate = twoWeeksLater.toISOString().split('T')[0];

    const response = await client.get(
      `/api/household/${householdId}/planner`,
      { params: { start_date: startDate, end_date: endDate } }
    );
    const plans = response.data || [];

    const formattedPlans = plans.map((plan: {
      id: number;
      day: string;
      recipe?: { id: number; name: string; photo?: string };
      recipe_id?: number;
      yields?: number;
    }) => ({
      id: plan.id,
      date: plan.day,
      recipe: plan.recipe ? {
        id: plan.recipe.id,
        name: plan.recipe.name,
        photo: plan.recipe.photo,
      } : null,
      yields: plan.yields,
    }));

    // Group by date
    const byDate: Record<string, Array<{ id: number; recipe: { name: string } | null; yields?: number }>> = {};
    for (const plan of formattedPlans) {
      if (!byDate[plan.date]) {
        byDate[plan.date] = [];
      }
      byDate[plan.date].push(plan);
    }

    // Get today's and upcoming plans
    const todayPlans = byDate[startDate] || [];
    const upcomingDates = Object.keys(byDate)
      .filter(d => d > startDate)
      .sort()
      .slice(0, 7);

    return {
      plans: formattedPlans,
      byDate,
      today: todayPlans,
      summary: {
        totalPlanned: plans.length,
        todayCount: todayPlans.length,
        upcomingDays: upcomingDates.length,
      },
    };
  }

  private async getExpenses(client: AxiosInstance, householdId: number): Promise<IntegrationData> {
    // Get recent expenses
    const response = await client.get(`/api/household/${householdId}/expense`);
    const expenses = response.data || [];

    // Get expense categories
    let categories: Array<{ id: number; name: string; color?: string }> = [];
    try {
      const categoriesResponse = await client.get(`/api/household/${householdId}/expense/category`);
      categories = categoriesResponse.data || [];
    } catch {
      // Categories may not exist
    }

    const formattedExpenses = expenses.map((expense: {
      id: number;
      name: string;
      amount: number;
      date: string;
      paid_by?: { id: number; name: string };
      category?: { id: number; name: string };
      created_at?: string;
    }) => ({
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      date: expense.date,
      paidBy: expense.paid_by?.name,
      category: expense.category?.name,
      createdAt: expense.created_at,
    }));

    // Sort by date descending
    formattedExpenses.sort((a: { date: string }, b: { date: string }) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Calculate totals
    const totalAmount = formattedExpenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

    // This month's expenses
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthExpenses = formattedExpenses.filter((e: { date: string }) =>
      e.date.startsWith(thisMonth)
    );
    const thisMonthTotal = thisMonthExpenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

    return {
      expenses: formattedExpenses.slice(0, 50),
      categories,
      summary: {
        totalExpenses: expenses.length,
        totalAmount,
        thisMonthCount: thisMonthExpenses.length,
        thisMonthTotal,
        categoryCount: categories.length,
      },
    };
  }

  private async getHousehold(client: AxiosInstance, householdId: number): Promise<IntegrationData> {
    // Get household info
    const householdResponse = await client.get(`/api/household/${householdId}`);
    const household = householdResponse.data;

    // Get members
    let members: Array<{ id: number; name: string; username: string }> = [];
    try {
      const membersResponse = await client.get(`/api/household/${householdId}/member`);
      members = membersResponse.data || [];
    } catch {
      // Members endpoint may vary
    }

    // Get counts from other endpoints
    let recipeCount = 0;
    let shoppingListCount = 0;
    let itemCount = 0;

    try {
      const recipesResponse = await client.get(`/api/household/${householdId}/recipe`);
      recipeCount = recipesResponse.data?.length || 0;
    } catch {}

    try {
      const listsResponse = await client.get(`/api/household/${householdId}/shoppinglist`);
      const lists = listsResponse.data || [];
      shoppingListCount = lists.length;

      // Get total items
      for (const list of lists) {
        try {
          const itemsResponse = await client.get(
            `/api/household/${householdId}/shoppinglist/${list.id}/items`
          );
          itemCount += itemsResponse.data?.length || 0;
        } catch {}
      }
    } catch {}

    return {
      household: {
        id: household.id,
        name: household.name,
        photo: household.photo,
        language: household.language,
        currency: household.currency,
      },
      members: members.map((m: { id: number; name: string; username: string }) => ({
        id: m.id,
        name: m.name,
        username: m.username,
      })),
      summary: {
        memberCount: members.length,
        recipeCount,
        shoppingListCount,
        itemCount,
      },
    };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'shopping-list',
        name: 'Shopping Lists',
        description: 'Shopping lists and items',
        widgetTypes: ['kitchenowl-shopping-list'],
      },
      {
        id: 'recipes',
        name: 'Recipes',
        description: 'Recipe collection',
        widgetTypes: ['kitchenowl-recipes'],
      },
      {
        id: 'meal-plan',
        name: 'Meal Plan',
        description: 'Meal planning schedule',
        widgetTypes: ['kitchenowl-meal-plan'],
      },
      {
        id: 'expenses',
        name: 'Expenses',
        description: 'Expense tracking',
        widgetTypes: ['kitchenowl-expenses'],
      },
      {
        id: 'household',
        name: 'Household',
        description: 'Household overview and statistics',
        widgetTypes: ['kitchenowl-household'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Authenticate with username and password',
        method: 'POST',
        endpoint: '/api/auth',
        implemented: true,
        category: 'Authentication',
        documentationUrl: 'https://docs.kitchenowl.org/dev/reference/API/',
      },
      {
        id: 'auth-refresh',
        name: 'Refresh Token',
        description: 'Refresh access token',
        method: 'GET',
        endpoint: '/api/auth/refresh',
        implemented: true,
        category: 'Authentication',
      },
      {
        id: 'auth-logout',
        name: 'Logout',
        description: 'Invalidate current session',
        method: 'DELETE',
        endpoint: '/api/auth',
        implemented: false,
        category: 'Authentication',
      },

      // User
      {
        id: 'user-info',
        name: 'Get User Info',
        description: 'Get current user information',
        method: 'GET',
        endpoint: '/api/user',
        implemented: true,
        category: 'User',
      },

      // Household
      {
        id: 'household-list',
        name: 'List Households',
        description: 'List all households for current user',
        method: 'GET',
        endpoint: '/api/household',
        implemented: true,
        category: 'Household',
      },
      {
        id: 'household-get',
        name: 'Get Household',
        description: 'Get household details',
        method: 'GET',
        endpoint: '/api/household/{id}',
        implemented: true,
        category: 'Household',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Household ID' },
        ],
      },
      {
        id: 'household-members',
        name: 'List Members',
        description: 'List household members',
        method: 'GET',
        endpoint: '/api/household/{id}/member',
        implemented: true,
        category: 'Household',
      },

      // Shopping Lists
      {
        id: 'shoppinglist-list',
        name: 'List Shopping Lists',
        description: 'Get all shopping lists',
        method: 'GET',
        endpoint: '/api/household/{id}/shoppinglist',
        implemented: true,
        category: 'Shopping',
      },
      {
        id: 'shoppinglist-items',
        name: 'Get Shopping List Items',
        description: 'Get items in a shopping list',
        method: 'GET',
        endpoint: '/api/household/{id}/shoppinglist/{listId}/items',
        implemented: true,
        category: 'Shopping',
        parameters: [
          { name: 'listId', type: 'number', required: true, description: 'Shopping list ID' },
        ],
      },
      {
        id: 'shoppinglist-add-item',
        name: 'Add Item to List',
        description: 'Add an item to a shopping list',
        method: 'POST',
        endpoint: '/api/household/{id}/shoppinglist/{listId}/item',
        implemented: false,
        category: 'Shopping',
      },

      // Recipes
      {
        id: 'recipe-list',
        name: 'List Recipes',
        description: 'Get all recipes',
        method: 'GET',
        endpoint: '/api/household/{id}/recipe',
        implemented: true,
        category: 'Recipes',
      },
      {
        id: 'recipe-get',
        name: 'Get Recipe',
        description: 'Get recipe details',
        method: 'GET',
        endpoint: '/api/household/{id}/recipe/{recipeId}',
        implemented: false,
        category: 'Recipes',
        parameters: [
          { name: 'recipeId', type: 'number', required: true, description: 'Recipe ID' },
        ],
      },
      {
        id: 'recipe-tags',
        name: 'List Recipe Tags',
        description: 'Get all recipe tags',
        method: 'GET',
        endpoint: '/api/household/{id}/tag',
        implemented: true,
        category: 'Recipes',
      },

      // Meal Planning
      {
        id: 'planner-get',
        name: 'Get Meal Plan',
        description: 'Get meal plan for date range',
        method: 'GET',
        endpoint: '/api/household/{id}/planner',
        implemented: true,
        category: 'Meal Planning',
        parameters: [
          { name: 'start_date', type: 'string', required: false, description: 'Start date (YYYY-MM-DD)' },
          { name: 'end_date', type: 'string', required: false, description: 'End date (YYYY-MM-DD)' },
        ],
      },
      {
        id: 'planner-add',
        name: 'Add to Meal Plan',
        description: 'Add a recipe to the meal plan',
        method: 'POST',
        endpoint: '/api/household/{id}/planner',
        implemented: false,
        category: 'Meal Planning',
      },

      // Expenses
      {
        id: 'expense-list',
        name: 'List Expenses',
        description: 'Get all expenses',
        method: 'GET',
        endpoint: '/api/household/{id}/expense',
        implemented: true,
        category: 'Expenses',
      },
      {
        id: 'expense-categories',
        name: 'List Expense Categories',
        description: 'Get expense categories',
        method: 'GET',
        endpoint: '/api/household/{id}/expense/category',
        implemented: true,
        category: 'Expenses',
      },
      {
        id: 'expense-add',
        name: 'Add Expense',
        description: 'Add a new expense',
        method: 'POST',
        endpoint: '/api/household/{id}/expense',
        implemented: false,
        category: 'Expenses',
      },

      // Items
      {
        id: 'item-list',
        name: 'List All Items',
        description: 'Get all items in household',
        method: 'GET',
        endpoint: '/api/household/{id}/item',
        implemented: false,
        category: 'Items',
      },
    ];
  }
}
