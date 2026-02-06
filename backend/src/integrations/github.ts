import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  GitHubConfig,
  GitHubUser,
  GitHubRepository,
  GitHubIssue,
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubNotification,
  GitHubContributionCalendar,
} from '../types';
import { logger } from '../services/logger';

export class GitHubIntegration extends BaseIntegration {
  readonly type = 'github';
  readonly name = 'GitHub';

  private createClient(config: GitHubConfig): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const githubConfig = config as GitHubConfig;

    try {
      const client = this.createClient(githubConfig);

      // Get authenticated user
      const userResponse = await client.get('/user');
      const user = userResponse.data as GitHubUser;

      // Check rate limit
      const rateLimitResponse = await client.get('/rate_limit');
      const rateLimit = rateLimitResponse.data.rate;

      return {
        success: true,
        message: `Connected as ${user.login} (${rateLimit.remaining}/${rateLimit.limit} API calls remaining)`,
        details: {
          username: user.login,
          name: user.name,
          publicRepos: user.public_repos,
          rateLimit: {
            remaining: rateLimit.remaining,
            limit: rateLimit.limit,
            reset: rateLimit.reset,
          },
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('github', 'Connection test failed', { error: errorMsg });

      // Check for specific error types
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Invalid token. Please check your Personal Access Token.',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access forbidden. Token may lack required scopes or rate limit exceeded.',
          };
        }
      }

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const githubConfig = config as GitHubConfig;
    const client = this.createClient(githubConfig);

    switch (metric) {
      case 'user-profile':
        return this.getUserProfile(client, githubConfig);
      case 'repositories':
        return this.getRepositories(client, githubConfig);
      case 'repository-stats':
        return this.getRepositoryStats(client, githubConfig);
      case 'issues':
        return this.getIssues(client, githubConfig);
      case 'pull-requests':
        return this.getPullRequests(client, githubConfig);
      case 'actions-status':
        return this.getActionsStatus(client, githubConfig);
      case 'notifications':
        return this.getNotifications(client, githubConfig);
      case 'contributions':
        return this.getContributions(client, githubConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getUserProfile(client: AxiosInstance, config: GitHubConfig): Promise<{ user: GitHubUser }> {
    try {
      const endpoint = config.username ? `/users/${config.username}` : '/user';
      const response = await client.get(endpoint);

      logger.debug('github', `Fetched user profile for ${response.data.login}`);
      return { user: response.data };
    } catch (error) {
      logger.error('github', 'Failed to fetch user profile', { error: String(error) });
      throw error;
    }
  }

  private async getRepositories(client: AxiosInstance, config: GitHubConfig): Promise<{ repositories: GitHubRepository[] }> {
    try {
      let endpoint = '/user/repos';
      const params: Record<string, string | number> = {
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      };

      // If username is specified, get their repos
      if (config.username) {
        endpoint = `/users/${config.username}/repos`;
      }
      // If defaultOrg is specified, get org repos
      if (config.defaultOrg) {
        endpoint = `/orgs/${config.defaultOrg}/repos`;
      }

      const response = await client.get(endpoint, { params });

      logger.debug('github', `Fetched ${response.data.length} repositories`);
      return { repositories: response.data };
    } catch (error) {
      logger.error('github', 'Failed to fetch repositories', { error: String(error) });
      return { repositories: [] };
    }
  }

  private async getRepositoryStats(client: AxiosInstance, _config: GitHubConfig): Promise<{ repository: GitHubRepository | null }> {
    // This requires repo filter from widget config, will be handled at widget level
    // Return null if no specific repo configured
    try {
      // This metric needs to be called with specific repo context
      // The repo info will come from widget filter
      return { repository: null };
    } catch (error) {
      logger.error('github', 'Failed to fetch repository stats', { error: String(error) });
      return { repository: null };
    }
  }

  private async getIssues(client: AxiosInstance, config: GitHubConfig): Promise<{ issues: GitHubIssue[] }> {
    try {
      // Default to getting issues assigned to user
      let endpoint = '/user/issues';
      const params: Record<string, string | number> = {
        per_page: 100,
        state: 'open',
        sort: 'updated',
        direction: 'desc',
      };

      const response = await client.get(endpoint, { params });

      // Filter out pull requests (GitHub API returns PRs as issues)
      const issues = response.data.filter((issue: GitHubIssue) => !issue.pull_request);

      logger.debug('github', `Fetched ${issues.length} issues`);
      return { issues };
    } catch (error) {
      logger.error('github', 'Failed to fetch issues', { error: String(error) });
      return { issues: [] };
    }
  }

  private async getPullRequests(client: AxiosInstance, _config: GitHubConfig): Promise<{ pullRequests: GitHubPullRequest[] }> {
    try {
      // Use search API to get PRs involving the user
      const response = await client.get('/search/issues', {
        params: {
          q: 'is:pr is:open involves:@me',
          sort: 'updated',
          order: 'desc',
          per_page: 100,
        },
      });

      const pullRequests = response.data.items || [];

      logger.debug('github', `Fetched ${pullRequests.length} pull requests`);
      return { pullRequests };
    } catch (error) {
      logger.error('github', 'Failed to fetch pull requests', { error: String(error) });
      return { pullRequests: [] };
    }
  }

  private async getActionsStatus(client: AxiosInstance, _config: GitHubConfig): Promise<{ runs: GitHubWorkflowRun[] }> {
    try {
      // This requires repo filter from widget config
      // Default behavior: return empty, widget will specify repo
      return { runs: [] };
    } catch (error) {
      logger.error('github', 'Failed to fetch actions status', { error: String(error) });
      return { runs: [] };
    }
  }

  private async getNotifications(client: AxiosInstance, _config: GitHubConfig): Promise<{ notifications: GitHubNotification[], unreadCount: number }> {
    try {
      const response = await client.get('/notifications', {
        params: {
          per_page: 50,
        },
      });

      const notifications = response.data as GitHubNotification[];
      const unreadCount = notifications.filter(n => n.unread).length;

      logger.debug('github', `Fetched ${notifications.length} notifications (${unreadCount} unread)`);
      return { notifications, unreadCount };
    } catch (error) {
      logger.error('github', 'Failed to fetch notifications', { error: String(error) });
      return { notifications: [], unreadCount: 0 };
    }
  }

  private async getContributions(client: AxiosInstance, config: GitHubConfig): Promise<{ contributions: GitHubContributionCalendar | null }> {
    try {
      // Contribution graph requires GraphQL API
      const username = config.username || (await client.get('/user')).data.login;

      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

      const query = `
        query($username: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $username) {
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    date
                    contributionCount
                    color
                  }
                }
              }
            }
          }
        }
      `;

      const response = await axios.post(
        'https://api.github.com/graphql',
        {
          query,
          variables: {
            username,
            from: oneYearAgo.toISOString(),
            to: now.toISOString(),
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const contributions = response.data?.data?.user?.contributionsCollection?.contributionCalendar || null;

      if (contributions) {
        logger.debug('github', `Fetched contribution data: ${contributions.totalContributions} total contributions`);
      }

      return { contributions };
    } catch (error) {
      logger.error('github', 'Failed to fetch contributions', { error: String(error) });
      return { contributions: null };
    }
  }

  // Helper method to fetch specific repo data (called from widgets with filter)
  async getRepoData(client: AxiosInstance, owner: string, repo: string): Promise<GitHubRepository> {
    const response = await client.get(`/repos/${owner}/${repo}`);
    return response.data;
  }

  // Helper method to fetch repo issues (called from widgets with filter)
  async getRepoIssues(client: AxiosInstance, owner: string, repo: string, params: Record<string, string | number> = {}): Promise<GitHubIssue[]> {
    const response = await client.get(`/repos/${owner}/${repo}/issues`, {
      params: {
        per_page: 100,
        state: 'open',
        ...params,
      },
    });
    return response.data.filter((issue: GitHubIssue) => !issue.pull_request);
  }

  // Helper method to fetch repo PRs (called from widgets with filter)
  async getRepoPRs(client: AxiosInstance, owner: string, repo: string, params: Record<string, string | number> = {}): Promise<GitHubPullRequest[]> {
    const response = await client.get(`/repos/${owner}/${repo}/pulls`, {
      params: {
        per_page: 100,
        state: 'open',
        ...params,
      },
    });
    return response.data;
  }

  // Helper method to fetch workflow runs (called from widgets with filter)
  async getWorkflowRuns(client: AxiosInstance, owner: string, repo: string, params: Record<string, string | number> = {}): Promise<GitHubWorkflowRun[]> {
    const response = await client.get(`/repos/${owner}/${repo}/actions/runs`, {
      params: {
        per_page: 20,
        ...params,
      },
    });
    return response.data.workflow_runs || [];
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'user-profile',
        name: 'User Profile',
        description: 'Authenticated user information and statistics',
        widgetTypes: ['github-profile'],
      },
      {
        id: 'repositories',
        name: 'Repositories',
        description: 'List of repositories with stats (stars, forks, language)',
        widgetTypes: ['github-repos'],
      },
      {
        id: 'repository-stats',
        name: 'Repository Statistics',
        description: 'Detailed statistics for a specific repository',
        widgetTypes: ['github-repo-stats'],
      },
      {
        id: 'issues',
        name: 'Issues',
        description: 'Repository or user issues with labels and assignees',
        widgetTypes: ['github-issues'],
      },
      {
        id: 'pull-requests',
        name: 'Pull Requests',
        description: 'Pull requests with review status and CI checks',
        widgetTypes: ['github-prs'],
      },
      {
        id: 'actions-status',
        name: 'Actions Workflows',
        description: 'GitHub Actions workflow runs and status',
        widgetTypes: ['github-actions'],
      },
      {
        id: 'notifications',
        name: 'Notifications',
        description: 'User notification inbox',
        widgetTypes: ['github-notifications'],
      },
      {
        id: 'contributions',
        name: 'Contribution Graph',
        description: 'Contribution calendar data (via GraphQL)',
        widgetTypes: ['github-contributions'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // User endpoints
      {
        id: 'user-get',
        name: 'Get Authenticated User',
        description: 'Get the authenticated user profile',
        method: 'GET',
        endpoint: '/user',
        implemented: true,
        category: 'User',
      },
      {
        id: 'user-get-by-username',
        name: 'Get User by Username',
        description: 'Get a specific user profile',
        method: 'GET',
        endpoint: '/users/{username}',
        implemented: true,
        category: 'User',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'GitHub username' },
        ],
      },

      // Repository endpoints
      {
        id: 'repos-list-user',
        name: 'List User Repositories',
        description: 'List repositories for the authenticated user',
        method: 'GET',
        endpoint: '/user/repos',
        implemented: true,
        category: 'Repositories',
        parameters: [
          { name: 'visibility', type: 'string', required: false, description: 'all, public, or private' },
          { name: 'sort', type: 'string', required: false, description: 'created, updated, pushed, full_name' },
          { name: 'per_page', type: 'number', required: false, description: 'Results per page (max 100)' },
        ],
      },
      {
        id: 'repos-get',
        name: 'Get Repository',
        description: 'Get a specific repository',
        method: 'GET',
        endpoint: '/repos/{owner}/{repo}',
        implemented: true,
        category: 'Repositories',
        parameters: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
        ],
      },

      // Issues endpoints
      {
        id: 'issues-list-user',
        name: 'List User Issues',
        description: 'List issues assigned to the authenticated user',
        method: 'GET',
        endpoint: '/user/issues',
        implemented: true,
        category: 'Issues',
        parameters: [
          { name: 'state', type: 'string', required: false, description: 'open, closed, or all' },
          { name: 'filter', type: 'string', required: false, description: 'assigned, created, mentioned, subscribed, all' },
          { name: 'labels', type: 'string', required: false, description: 'Comma-separated label names' },
          { name: 'sort', type: 'string', required: false, description: 'created, updated, comments' },
        ],
      },
      {
        id: 'issues-list-repo',
        name: 'List Repository Issues',
        description: 'List issues for a repository',
        method: 'GET',
        endpoint: '/repos/{owner}/{repo}/issues',
        implemented: true,
        category: 'Issues',
        parameters: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
          { name: 'state', type: 'string', required: false, description: 'open, closed, or all' },
          { name: 'labels', type: 'string', required: false, description: 'Comma-separated label names' },
        ],
      },

      // Pull Requests endpoints
      {
        id: 'pulls-list-repo',
        name: 'List Repository Pull Requests',
        description: 'List pull requests for a repository',
        method: 'GET',
        endpoint: '/repos/{owner}/{repo}/pulls',
        implemented: true,
        category: 'Pull Requests',
        parameters: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
          { name: 'state', type: 'string', required: false, description: 'open, closed, or all' },
          { name: 'sort', type: 'string', required: false, description: 'created, updated, popularity' },
        ],
      },
      {
        id: 'search-issues',
        name: 'Search Issues and PRs',
        description: 'Search issues and pull requests',
        method: 'GET',
        endpoint: '/search/issues',
        implemented: true,
        category: 'Search',
        parameters: [
          { name: 'q', type: 'string', required: true, description: 'Search query' },
          { name: 'sort', type: 'string', required: false, description: 'comments, created, updated' },
          { name: 'order', type: 'string', required: false, description: 'asc or desc' },
        ],
      },

      // Actions endpoints
      {
        id: 'actions-list-runs',
        name: 'List Workflow Runs',
        description: 'List workflow runs for a repository',
        method: 'GET',
        endpoint: '/repos/{owner}/{repo}/actions/runs',
        implemented: true,
        category: 'Actions',
        parameters: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
          { name: 'branch', type: 'string', required: false, description: 'Filter by branch' },
          { name: 'status', type: 'string', required: false, description: 'queued, in_progress, completed, etc.' },
        ],
      },
      {
        id: 'actions-list-workflows',
        name: 'List Workflows',
        description: 'List workflows for a repository',
        method: 'GET',
        endpoint: '/repos/{owner}/{repo}/actions/workflows',
        implemented: false,
        category: 'Actions',
        parameters: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
        ],
      },

      // Notifications endpoints
      {
        id: 'notifications-list',
        name: 'List Notifications',
        description: 'List all notifications for the authenticated user',
        method: 'GET',
        endpoint: '/notifications',
        implemented: true,
        category: 'Notifications',
        parameters: [
          { name: 'all', type: 'boolean', required: false, description: 'Show all notifications' },
          { name: 'participating', type: 'boolean', required: false, description: 'Only participating' },
        ],
      },
      {
        id: 'notifications-mark-read',
        name: 'Mark Notifications as Read',
        description: 'Mark all notifications as read',
        method: 'PUT',
        endpoint: '/notifications',
        implemented: false,
        category: 'Notifications',
      },

      // GraphQL endpoint
      {
        id: 'graphql',
        name: 'GraphQL API',
        description: 'Execute GraphQL queries (used for contribution graph)',
        method: 'POST',
        endpoint: '/graphql',
        implemented: true,
        category: 'GraphQL',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'GraphQL query' },
          { name: 'variables', type: 'object', required: false, description: 'Query variables' },
        ],
      },

      // Rate limit
      {
        id: 'rate-limit',
        name: 'Get Rate Limit',
        description: 'Get rate limit status for the authenticated user',
        method: 'GET',
        endpoint: '/rate_limit',
        implemented: true,
        category: 'System',
      },
    ];
  }
}
