import axios, { AxiosInstance } from 'axios';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import {
  IntegrationData,
  NotionConfig,
  NotionUser,
  NotionDatabase,
  NotionPage,
  NotionRichText,
} from '../types';

export class NotionIntegration extends BaseIntegration {
  readonly type = 'notion';
  readonly name = 'Notion';

  private createClient(config: NotionConfig): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.notion.com/v1',
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
    });
  }

  async testConnection(config: NotionConfig): Promise<ConnectionTestResult> {
    try {
      const client = this.createClient(config);
      const response = await client.get('/users/me');

      if (response.data?.id) {
        const user = response.data as NotionUser;
        const name = user.name || (user.bot?.owner?.workspace ? 'Workspace Bot' : 'Bot');
        return {
          success: true,
          message: `Connected as ${name}`,
        };
      }

      return {
        success: false,
        message: 'Invalid API response',
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid integration token',
        };
      }
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
      };
    }
  }

  async getData(config: NotionConfig, metric: string): Promise<IntegrationData> {
    const client = this.createClient(config);

    // Handle database-items:databaseId format
    if (metric.startsWith('database-items:')) {
      const databaseId = metric.split(':')[1];
      return this.getDatabaseItems(client, databaseId);
    }

    switch (metric) {
      case 'workspace':
        return this.getWorkspace(client);
      case 'databases':
        return this.getDatabases(client);
      case 'database-items':
        // No database ID provided
        return {
          items: [],
          database: null,
          total: 0,
          message: 'No database selected',
        };
      case 'recent':
        return this.getRecentPages(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getWorkspace(client: AxiosInstance): Promise<IntegrationData> {
    const [botResp, searchResp] = await Promise.all([
      client.get('/users/me'),
      client.post('/search', {
        page_size: 100,
      }),
    ]);

    const bot = botResp.data as NotionUser;
    const results = searchResp.data.results || [];

    const databases = results.filter((r: { object: string }) => r.object === 'database');
    const pages = results.filter((r: { object: string }) => r.object === 'page');

    // Get recent activity (last 10 items sorted by last_edited_time)
    const recentItems = results
      .sort((a: { last_edited_time: string }, b: { last_edited_time: string }) =>
        new Date(b.last_edited_time).getTime() - new Date(a.last_edited_time).getTime()
      )
      .slice(0, 10)
      .map((item: NotionPage | NotionDatabase) => ({
        id: item.id,
        type: item.object,
        title: this.getItemTitle(item),
        icon: this.getIconValue(item.icon),
        lastEdited: item.last_edited_time,
        url: item.url,
      }));

    return {
      bot: {
        id: bot.id,
        name: bot.name,
        type: bot.type,
        avatarUrl: bot.avatar_url,
      },
      counts: {
        databases: databases.length,
        pages: pages.length,
        total: results.length,
      },
      recentActivity: recentItems,
    };
  }

  private async getDatabases(client: AxiosInstance): Promise<IntegrationData> {
    const response = await client.post('/search', {
      filter: {
        property: 'object',
        value: 'database',
      },
      page_size: 100,
    });

    const databases = (response.data.results || []) as NotionDatabase[];

    return {
      databases: databases.map(db => ({
        id: db.id,
        title: this.getRichTextPlain(db.title),
        description: this.getRichTextPlain(db.description),
        icon: this.getIconValue(db.icon),
        coverUrl: this.getFileUrl(db.cover),
        propertyCount: Object.keys(db.properties).length,
        properties: Object.entries(db.properties).map(([name, schema]) => ({
          name,
          type: schema.type,
        })),
        createdTime: db.created_time,
        lastEditedTime: db.last_edited_time,
        url: db.url,
      })),
      total: databases.length,
    };
  }

  private async getDatabaseItems(client: AxiosInstance, databaseId: string): Promise<IntegrationData> {
    const [dbResp, itemsResp] = await Promise.all([
      client.get(`/databases/${databaseId}`),
      client.post(`/databases/${databaseId}/query`, {
        page_size: 100,
      }),
    ]);

    const database = dbResp.data as NotionDatabase;
    const items = (itemsResp.data.results || []) as NotionPage[];

    return {
      database: {
        id: database.id,
        title: this.getRichTextPlain(database.title),
        icon: this.getIconValue(database.icon),
        properties: Object.entries(database.properties).map(([name, schema]) => ({
          name,
          type: schema.type,
          id: schema.id,
        })),
      },
      items: items.map(item => this.formatPageItem(item, database)),
      total: items.length,
      hasMore: itemsResp.data.has_more,
    };
  }

  private async getRecentPages(client: AxiosInstance): Promise<IntegrationData> {
    const response = await client.post('/search', {
      filter: {
        property: 'object',
        value: 'page',
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
      page_size: 50,
    });

    const pages = (response.data.results || []) as NotionPage[];

    return {
      pages: pages.map(page => ({
        id: page.id,
        title: this.getPageTitle(page),
        icon: this.getIconValue(page.icon),
        coverUrl: this.getFileUrl(page.cover),
        parent: this.getParentInfo(page.parent),
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time,
        createdBy: page.created_by.id,
        lastEditedBy: page.last_edited_by.id,
        url: page.url,
      })),
      total: pages.length,
    };
  }

  private formatPageItem(page: NotionPage, database: NotionDatabase): Record<string, unknown> {
    const formatted: Record<string, unknown> = {
      id: page.id,
      url: page.url,
      icon: this.getIconValue(page.icon),
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
    };

    // Extract property values
    for (const [name, schema] of Object.entries(database.properties)) {
      const value = page.properties[name];
      if (value) {
        formatted[name] = this.formatPropertyValue(value);
      }
    }

    return formatted;
  }

  private formatPropertyValue(prop: { type: string; title?: NotionRichText[]; rich_text?: NotionRichText[]; number?: number | null; select?: { name: string; color: string } | null; multi_select?: Array<{ name: string; color: string }>; date?: { start: string; end?: string | null } | null; checkbox?: boolean; status?: { name: string; color: string } | null; url?: string | null; email?: string | null; phone_number?: string | null; people?: Array<{ id: string; name?: string }>; created_time?: string; last_edited_time?: string }): unknown {
    switch (prop.type) {
      case 'title':
        return this.getRichTextPlain(prop.title || []);
      case 'rich_text':
        return this.getRichTextPlain(prop.rich_text || []);
      case 'number':
        return prop.number;
      case 'select':
        return prop.select ? { name: prop.select.name, color: prop.select.color } : null;
      case 'multi_select':
        return (prop.multi_select || []).map(s => ({ name: s.name, color: s.color }));
      case 'date':
        return prop.date ? { start: prop.date.start, end: prop.date.end } : null;
      case 'checkbox':
        return prop.checkbox;
      case 'status':
        return prop.status ? { name: prop.status.name, color: prop.status.color } : null;
      case 'url':
        return prop.url;
      case 'email':
        return prop.email;
      case 'phone_number':
        return prop.phone_number;
      case 'people':
        return (prop.people || []).map(p => ({ id: p.id, name: p.name }));
      case 'created_time':
        return prop.created_time;
      case 'last_edited_time':
        return prop.last_edited_time;
      default:
        return null;
    }
  }

  private getRichTextPlain(richText: NotionRichText[]): string {
    return richText.map(t => t.plain_text).join('');
  }

  private getIconValue(icon: { type: string; emoji?: string; external?: { url: string }; file?: { url: string } } | null): string | null {
    if (!icon) return null;
    if (icon.type === 'emoji') return icon.emoji || null;
    if (icon.type === 'external') return icon.external?.url || null;
    if (icon.type === 'file') return icon.file?.url || null;
    return null;
  }

  private getFileUrl(file: { type: string; external?: { url: string }; file?: { url: string } } | null): string | null {
    if (!file) return null;
    if (file.type === 'external') return file.external?.url || null;
    if (file.type === 'file') return file.file?.url || null;
    return null;
  }

  private getItemTitle(item: NotionPage | NotionDatabase): string {
    if (item.object === 'database') {
      return this.getRichTextPlain((item as NotionDatabase).title);
    }
    return this.getPageTitle(item as NotionPage);
  }

  private getPageTitle(page: NotionPage): string {
    // Find the title property
    for (const value of Object.values(page.properties)) {
      if (value.type === 'title' && value.title) {
        return this.getRichTextPlain(value.title);
      }
    }
    return 'Untitled';
  }

  private getParentInfo(parent: { type: string; database_id?: string; page_id?: string; workspace?: boolean }): { type: string; id?: string } {
    if (parent.type === 'database_id') {
      return { type: 'database', id: parent.database_id };
    }
    if (parent.type === 'page_id') {
      return { type: 'page', id: parent.page_id };
    }
    if (parent.type === 'workspace') {
      return { type: 'workspace' };
    }
    return { type: parent.type };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      { id: 'workspace', name: 'Workspace', description: 'Workspace info and quick stats', widgetTypes: ['notion-workspace'] },
      { id: 'databases', name: 'Databases', description: 'List of accessible databases', widgetTypes: ['notion-databases'] },
      { id: 'database-items', name: 'Database Items', description: 'Items from a specific database', widgetTypes: ['notion-database-view', 'notion-task-list'] },
      { id: 'recent', name: 'Recent Pages', description: 'Recently edited pages', widgetTypes: ['notion-recent'] },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Users - Implemented
      {
        id: 'get-self',
        name: 'Retrieve Bot User',
        description: 'Retrieve the bot User associated with the API token',
        method: 'GET',
        endpoint: '/users/me',
        implemented: true,
        category: 'Users',
        documentationUrl: 'https://developers.notion.com/reference/get-self',
      },
      {
        id: 'list-users',
        name: 'List All Users',
        description: 'Return a paginated list of Users for the workspace',
        method: 'GET',
        endpoint: '/users',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'start_cursor', type: 'string', required: false, description: 'Pagination cursor from previous response' },
          { name: 'page_size', type: 'number', required: false, description: 'Number of results to return (max 100)' },
        ],
      },
      {
        id: 'retrieve-user',
        name: 'Retrieve a User',
        description: 'Retrieve a User using the user ID',
        method: 'GET',
        endpoint: '/users/:user_id',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user to retrieve' },
        ],
      },

      // Databases - Implemented
      {
        id: 'query-database',
        name: 'Query a Database',
        description: 'Get a list of Pages contained in the database, filtered and ordered according to the filter conditions and sort criteria',
        method: 'POST',
        endpoint: '/databases/:database_id/query',
        implemented: true,
        category: 'Databases',
        parameters: [
          { name: 'database_id', type: 'string', required: true, description: 'ID of the database to query' },
          { name: 'filter', type: 'object', required: false, description: 'Filter conditions' },
          { name: 'sorts', type: 'array', required: false, description: 'Sort criteria' },
          { name: 'start_cursor', type: 'string', required: false, description: 'Pagination cursor' },
          { name: 'page_size', type: 'number', required: false, description: 'Number of results (max 100)' },
        ],
      },
      {
        id: 'retrieve-database',
        name: 'Retrieve a Database',
        description: 'Retrieve a Database object using the database ID',
        method: 'GET',
        endpoint: '/databases/:database_id',
        implemented: true,
        category: 'Databases',
        parameters: [
          { name: 'database_id', type: 'string', required: true, description: 'ID of the database to retrieve' },
        ],
      },
      {
        id: 'create-database',
        name: 'Create a Database',
        description: 'Create a new database as a subpage of an existing page',
        method: 'POST',
        endpoint: '/databases',
        implemented: false,
        category: 'Databases',
        parameters: [
          { name: 'parent', type: 'object', required: true, description: 'Parent page reference' },
          { name: 'title', type: 'array', required: false, description: 'Database title as rich text' },
          { name: 'properties', type: 'object', required: true, description: 'Database property schema' },
          { name: 'icon', type: 'object', required: false, description: 'Page icon (emoji or external file)' },
          { name: 'cover', type: 'object', required: false, description: 'Page cover image' },
          { name: 'is_inline', type: 'boolean', required: false, description: 'Whether database is inline' },
        ],
      },
      {
        id: 'update-database',
        name: 'Update a Database',
        description: 'Update the title, description, or properties of an existing database',
        method: 'PATCH',
        endpoint: '/databases/:database_id',
        implemented: false,
        category: 'Databases',
        parameters: [
          { name: 'database_id', type: 'string', required: true, description: 'ID of the database to update' },
          { name: 'title', type: 'array', required: false, description: 'New database title' },
          { name: 'description', type: 'array', required: false, description: 'New database description' },
          { name: 'properties', type: 'object', required: false, description: 'Property schema updates' },
          { name: 'icon', type: 'object', required: false, description: 'New page icon' },
          { name: 'cover', type: 'object', required: false, description: 'New page cover' },
          { name: 'is_inline', type: 'boolean', required: false, description: 'Whether database is inline' },
        ],
      },

      // Pages - Partially Implemented
      {
        id: 'retrieve-page',
        name: 'Retrieve a Page',
        description: 'Retrieve a Page object using the page ID',
        method: 'GET',
        endpoint: '/pages/:page_id',
        implemented: false,
        category: 'Pages',
        parameters: [
          { name: 'page_id', type: 'string', required: true, description: 'ID of the page to retrieve' },
          { name: 'filter_properties', type: 'string', required: false, description: 'Comma-separated property IDs to filter' },
        ],
      },
      {
        id: 'create-page',
        name: 'Create a Page',
        description: 'Create a new page in a database or as a child of an existing page',
        method: 'POST',
        endpoint: '/pages',
        implemented: false,
        category: 'Pages',
        parameters: [
          { name: 'parent', type: 'object', required: true, description: 'Parent (database_id or page_id)' },
          { name: 'properties', type: 'object', required: true, description: 'Page property values' },
          { name: 'children', type: 'array', required: false, description: 'Page content as blocks' },
          { name: 'icon', type: 'object', required: false, description: 'Page icon' },
          { name: 'cover', type: 'object', required: false, description: 'Page cover image' },
        ],
      },
      {
        id: 'update-page',
        name: 'Update Page Properties',
        description: 'Update page property values for the specified page',
        method: 'PATCH',
        endpoint: '/pages/:page_id',
        implemented: false,
        category: 'Pages',
        parameters: [
          { name: 'page_id', type: 'string', required: true, description: 'ID of the page to update' },
          { name: 'properties', type: 'object', required: false, description: 'Property values to update' },
          { name: 'icon', type: 'object', required: false, description: 'New page icon' },
          { name: 'cover', type: 'object', required: false, description: 'New page cover' },
          { name: 'archived', type: 'boolean', required: false, description: 'Archive or unarchive the page' },
        ],
      },
      {
        id: 'retrieve-page-property',
        name: 'Retrieve Page Property Item',
        description: 'Retrieve a property_item object for a given page and property',
        method: 'GET',
        endpoint: '/pages/:page_id/properties/:property_id',
        implemented: false,
        category: 'Pages',
        parameters: [
          { name: 'page_id', type: 'string', required: true, description: 'ID of the page' },
          { name: 'property_id', type: 'string', required: true, description: 'ID of the property' },
          { name: 'start_cursor', type: 'string', required: false, description: 'Pagination cursor' },
          { name: 'page_size', type: 'number', required: false, description: 'Number of results' },
        ],
      },
      {
        id: 'archive-page',
        name: 'Archive a Page',
        description: 'Archive (trash) a page by setting archived to true',
        method: 'PATCH',
        endpoint: '/pages/:page_id',
        implemented: false,
        category: 'Pages',
        parameters: [
          { name: 'page_id', type: 'string', required: true, description: 'ID of the page to archive' },
          { name: 'archived', type: 'boolean', required: true, description: 'Set to true to archive' },
        ],
      },

      // Blocks
      {
        id: 'retrieve-block',
        name: 'Retrieve a Block',
        description: 'Retrieve a Block object using the block ID',
        method: 'GET',
        endpoint: '/blocks/:block_id',
        implemented: false,
        category: 'Blocks',
        parameters: [
          { name: 'block_id', type: 'string', required: true, description: 'ID of the block to retrieve' },
        ],
      },
      {
        id: 'update-block',
        name: 'Update a Block',
        description: 'Update the content of a block based on the block type',
        method: 'PATCH',
        endpoint: '/blocks/:block_id',
        implemented: false,
        category: 'Blocks',
        parameters: [
          { name: 'block_id', type: 'string', required: true, description: 'ID of the block to update' },
          { name: 'type', type: 'object', required: false, description: 'Block-type-specific content' },
          { name: 'archived', type: 'boolean', required: false, description: 'Archive the block' },
        ],
      },
      {
        id: 'retrieve-block-children',
        name: 'Retrieve Block Children',
        description: 'Return a paginated array of child block objects contained in the block',
        method: 'GET',
        endpoint: '/blocks/:block_id/children',
        implemented: false,
        category: 'Blocks',
        parameters: [
          { name: 'block_id', type: 'string', required: true, description: 'ID of the parent block' },
          { name: 'start_cursor', type: 'string', required: false, description: 'Pagination cursor' },
          { name: 'page_size', type: 'number', required: false, description: 'Number of results (max 100)' },
        ],
      },
      {
        id: 'append-block-children',
        name: 'Append Block Children',
        description: 'Create and append new children blocks to the parent block',
        method: 'PATCH',
        endpoint: '/blocks/:block_id/children',
        implemented: false,
        category: 'Blocks',
        parameters: [
          { name: 'block_id', type: 'string', required: true, description: 'ID of the parent block' },
          { name: 'children', type: 'array', required: true, description: 'Array of block objects to append' },
          { name: 'after', type: 'string', required: false, description: 'Block ID to append after' },
        ],
      },
      {
        id: 'delete-block',
        name: 'Delete a Block',
        description: 'Set a block to archived: true (soft delete)',
        method: 'DELETE',
        endpoint: '/blocks/:block_id',
        implemented: false,
        category: 'Blocks',
        parameters: [
          { name: 'block_id', type: 'string', required: true, description: 'ID of the block to delete' },
        ],
      },

      // Search - Implemented
      {
        id: 'search',
        name: 'Search',
        description: 'Search all pages and databases shared with the integration',
        method: 'POST',
        endpoint: '/search',
        implemented: true,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: false, description: 'Text to search for in page titles' },
          { name: 'filter', type: 'object', required: false, description: 'Filter by object type (page or database)' },
          { name: 'sort', type: 'object', required: false, description: 'Sort direction and timestamp' },
          { name: 'start_cursor', type: 'string', required: false, description: 'Pagination cursor' },
          { name: 'page_size', type: 'number', required: false, description: 'Number of results (max 100)' },
        ],
      },

      // Comments
      {
        id: 'create-comment',
        name: 'Create a Comment',
        description: 'Create a new comment on a page or in a discussion thread',
        method: 'POST',
        endpoint: '/comments',
        implemented: false,
        category: 'Comments',
        parameters: [
          { name: 'parent', type: 'object', required: true, description: 'Parent page_id or discussion_id' },
          { name: 'rich_text', type: 'array', required: true, description: 'Comment content as rich text' },
        ],
      },
      {
        id: 'retrieve-comments',
        name: 'Retrieve Comments',
        description: 'Retrieve a list of un-resolved comments from a block',
        method: 'GET',
        endpoint: '/comments',
        implemented: false,
        category: 'Comments',
        parameters: [
          { name: 'block_id', type: 'string', required: true, description: 'ID of the block to get comments for' },
          { name: 'start_cursor', type: 'string', required: false, description: 'Pagination cursor' },
          { name: 'page_size', type: 'number', required: false, description: 'Number of results' },
        ],
      },

      // Authentication/OAuth
      {
        id: 'create-token',
        name: 'Create a Token',
        description: 'Create an access token using OAuth authorization code',
        method: 'POST',
        endpoint: '/oauth/token',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'grant_type', type: 'string', required: true, description: 'Must be "authorization_code"' },
          { name: 'code', type: 'string', required: true, description: 'OAuth authorization code' },
          { name: 'redirect_uri', type: 'string', required: true, description: 'Redirect URI from OAuth flow' },
        ],
      },
      {
        id: 'introspect-token',
        name: 'Introspect a Token',
        description: 'Get a token\'s active status, scope, and issued time',
        method: 'GET',
        endpoint: '/oauth/introspect',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'token', type: 'string', required: true, description: 'Token to introspect' },
        ],
      },
      {
        id: 'revoke-token',
        name: 'Revoke a Token',
        description: 'Revoke an access token',
        method: 'POST',
        endpoint: '/oauth/revoke',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'token', type: 'string', required: true, description: 'Token to revoke' },
        ],
      },
    ];
  }
}
