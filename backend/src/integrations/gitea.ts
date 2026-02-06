import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  GiteaConfig,
  GiteaUser,
  GiteaRepository,
  GiteaOrganization,
  GiteaIssue,
  GiteaPullRequest,
  GiteaNotification,
  GiteaTeam,
  GiteaHeatmapEntry,
} from '../types';
import { logger } from '../services/logger';

export class GiteaIntegration extends BaseIntegration {
  readonly type = 'gitea';
  readonly name = 'Gitea';

  private createClient(config: GiteaConfig): AxiosInstance {
    // Determine protocol: use HTTPS by default, HTTP only if explicitly port 80 or host starts with http://
    let host = config.host || '';
    let protocol = 'https';

    // Check if host includes protocol
    if (host.startsWith('http://')) {
      protocol = 'http';
      host = host.replace('http://', '');
    } else if (host.startsWith('https://')) {
      protocol = 'https';
      host = host.replace('https://', '');
    } else if (config.port === 80) {
      protocol = 'http';
    } else if (config.useSSL === false) {
      protocol = 'http';
    }

    const port = config.port ? `:${config.port}` : '';
    const baseURL = `${protocol}://${host}${port}/api/v1`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Token authentication (preferred)
    if (config.token) {
      headers['Authorization'] = `token ${config.token}`;
    }

    // 2FA OTP header if provided
    if (config.otp) {
      headers['X-Gitea-OTP'] = config.otp;
    }

    return axios.create({
      baseURL,
      headers,
      timeout: 15000,
      // Basic auth if username/password provided
      auth: config.username && config.password ? {
        username: config.username,
        password: config.password,
      } : undefined,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL !== false,
      }),
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const giteaConfig = config as GiteaConfig;

    try {
      const client = this.createClient(giteaConfig);

      // Get authenticated user
      const userResponse = await client.get('/user');
      const user = userResponse.data as GiteaUser;

      return {
        success: true,
        message: `Connected as ${user.login}${user.is_admin ? ' (Admin)' : ''}`,
        details: {
          username: user.login,
          fullName: user.full_name,
          isAdmin: user.is_admin,
          email: user.email,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('gitea', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Invalid credentials. Check your token or username/password.',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access forbidden. Token may lack required scopes.',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused. Check host and port settings.`,
          };
        }
        if (error.code === 'ENOTFOUND') {
          return {
            success: false,
            message: `Host not found: ${giteaConfig.host}`,
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
    const giteaConfig = config as GiteaConfig;
    const client = this.createClient(giteaConfig);

    switch (metric) {
      case 'overview':
        return this.getOverview(client);
      case 'repositories':
        return this.getRepositories(client);
      case 'issues':
        return this.getIssues(client);
      case 'pull-requests':
        return this.getPullRequests(client);
      case 'activity':
        return this.getActivity(client);
      case 'organizations':
        return this.getOrganizations(client);
      case 'notifications':
        return this.getNotifications(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getOverview(client: AxiosInstance): Promise<{
    user: GiteaUser;
    stats: {
      totalRepos: number;
      publicRepos: number;
      privateRepos: number;
      organizations: number;
      stars: number;
      followers: number;
      following: number;
    };
  }> {
    try {
      // Get user info
      const userResponse = await client.get('/user');
      const user = userResponse.data as GiteaUser;

      // Get user repos to count public/private
      const reposResponse = await client.get('/user/repos', {
        params: { limit: 100 },
      });
      const repos = reposResponse.data as GiteaRepository[];

      // Get organizations
      const orgsResponse = await client.get('/user/orgs', {
        params: { limit: 100 },
      });
      const orgs = orgsResponse.data as GiteaOrganization[];

      const publicRepos = repos.filter(r => !r.private).length;
      const privateRepos = repos.filter(r => r.private).length;

      logger.debug('gitea', `Fetched overview for ${user.login}`);

      return {
        user,
        stats: {
          totalRepos: repos.length,
          publicRepos,
          privateRepos,
          organizations: orgs.length,
          stars: user.starred_repos_count || 0,
          followers: user.followers_count || 0,
          following: user.following_count || 0,
        },
      };
    } catch (error) {
      logger.error('gitea', 'Failed to fetch overview', { error: String(error) });
      throw error;
    }
  }

  private async getRepositories(client: AxiosInstance): Promise<{ repositories: GiteaRepository[]; total: number }> {
    try {
      const response = await client.get('/user/repos', {
        params: {
          limit: 100,
        },
      });

      const repositories = response.data as GiteaRepository[];
      const total = parseInt(response.headers['x-total-count'] || String(repositories.length), 10);

      logger.debug('gitea', `Fetched ${repositories.length} repositories`);
      return { repositories, total };
    } catch (error) {
      logger.error('gitea', 'Failed to fetch repositories', { error: String(error) });
      return { repositories: [], total: 0 };
    }
  }

  private async getIssues(client: AxiosInstance): Promise<{ issues: GiteaIssue[]; total: number }> {
    try {
      // Search for issues involving the user
      const response = await client.get('/repos/issues/search', {
        params: {
          state: 'open',
          limit: 100,
        },
      });

      const issues = response.data as GiteaIssue[];
      const total = parseInt(response.headers['x-total-count'] || String(issues.length), 10);

      logger.debug('gitea', `Fetched ${issues.length} issues`);
      return { issues, total };
    } catch (error) {
      logger.error('gitea', 'Failed to fetch issues', { error: String(error) });
      return { issues: [], total: 0 };
    }
  }

  private async getPullRequests(client: AxiosInstance): Promise<{ pullRequests: GiteaPullRequest[]; total: number }> {
    try {
      // Get user's repos first, then fetch PRs from each
      const reposResponse = await client.get('/user/repos', {
        params: { limit: 50 },
      });
      const repos = reposResponse.data as GiteaRepository[];

      const allPRs: GiteaPullRequest[] = [];

      // Fetch PRs from repos with open PR counter > 0
      for (const repo of repos.filter(r => r.open_pr_counter > 0).slice(0, 10)) {
        try {
          const prsResponse = await client.get(`/repos/${repo.full_name}/pulls`, {
            params: { state: 'open', limit: 20 },
          });
          allPRs.push(...prsResponse.data);
        } catch {
          // Skip repos we can't access
        }
      }

      logger.debug('gitea', `Fetched ${allPRs.length} pull requests`);
      return { pullRequests: allPRs, total: allPRs.length };
    } catch (error) {
      logger.error('gitea', 'Failed to fetch pull requests', { error: String(error) });
      return { pullRequests: [], total: 0 };
    }
  }

  private async getActivity(client: AxiosInstance): Promise<{
    heatmap: GiteaHeatmapEntry[];
  }> {
    try {
      // Get user info first for username
      const userResponse = await client.get('/user');
      const user = userResponse.data as GiteaUser;

      // Get contribution heatmap
      const heatmapResponse = await client.get(`/users/${user.login}/heatmap`);
      const heatmap = heatmapResponse.data as GiteaHeatmapEntry[];

      logger.debug('gitea', `Fetched activity heatmap with ${heatmap.length} entries`);
      return { heatmap };
    } catch (error) {
      logger.error('gitea', 'Failed to fetch activity', { error: String(error) });
      return { heatmap: [] };
    }
  }

  private async getOrganizations(client: AxiosInstance): Promise<{
    organizations: Array<GiteaOrganization & { repoCount?: number; memberCount?: number; teams?: GiteaTeam[] }>;
    total: number;
  }> {
    try {
      const response = await client.get('/user/orgs', {
        params: { limit: 100 },
      });

      const orgs = response.data as GiteaOrganization[];
      const total = parseInt(response.headers['x-total-count'] || String(orgs.length), 10);

      // Enrich with additional data
      const enrichedOrgs = await Promise.all(
        orgs.map(async (org) => {
          try {
            // Get org repos count
            const reposResponse = await client.get(`/orgs/${org.username}/repos`, {
              params: { limit: 1 },
            });
            const repoCount = parseInt(reposResponse.headers['x-total-count'] || '0', 10);

            // Get org members count
            const membersResponse = await client.get(`/orgs/${org.username}/members`, {
              params: { limit: 1 },
            });
            const memberCount = parseInt(membersResponse.headers['x-total-count'] || '0', 10);

            // Get teams
            let teams: GiteaTeam[] = [];
            try {
              const teamsResponse = await client.get(`/orgs/${org.username}/teams`, {
                params: { limit: 50 },
              });
              teams = teamsResponse.data || [];
            } catch {
              // Teams may not be accessible
            }

            return { ...org, repoCount, memberCount, teams };
          } catch {
            return { ...org, repoCount: 0, memberCount: 0, teams: [] };
          }
        })
      );

      logger.debug('gitea', `Fetched ${orgs.length} organizations`);
      return { organizations: enrichedOrgs, total };
    } catch (error) {
      logger.error('gitea', 'Failed to fetch organizations', { error: String(error) });
      return { organizations: [], total: 0 };
    }
  }

  private async getNotifications(client: AxiosInstance): Promise<{
    notifications: GiteaNotification[];
    unreadCount: number;
    total: number;
  }> {
    try {
      const response = await client.get('/notifications', {
        params: { limit: 50 },
      });

      const notifications = response.data as GiteaNotification[];
      const total = parseInt(response.headers['x-total-count'] || String(notifications.length), 10);
      const unreadCount = notifications.filter(n => n.unread).length;

      // Get new notifications count
      try {
        const newResponse = await client.get('/notifications/new');
        const newCount = newResponse.data?.new || unreadCount;
        logger.debug('gitea', `Fetched ${notifications.length} notifications (${newCount} new)`);
      } catch {
        // Ignore if this endpoint isn't available
      }

      return { notifications, unreadCount, total };
    } catch (error) {
      logger.error('gitea', 'Failed to fetch notifications', { error: String(error) });
      return { notifications: [], unreadCount: 0, total: 0 };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'overview',
        name: 'Overview',
        description: 'Account summary with repository and organization statistics',
        widgetTypes: ['gitea-overview'],
      },
      {
        id: 'repositories',
        name: 'Repositories',
        description: 'List of repositories with stars, forks, and activity',
        widgetTypes: ['gitea-repositories'],
      },
      {
        id: 'issues',
        name: 'Issues',
        description: 'Issues across repositories with filtering',
        widgetTypes: ['gitea-issues'],
      },
      {
        id: 'pull-requests',
        name: 'Pull Requests',
        description: 'Pull requests with review and merge status',
        widgetTypes: ['gitea-pull-requests'],
      },
      {
        id: 'activity',
        name: 'Activity',
        description: 'Contribution heatmap and recent activity',
        widgetTypes: ['gitea-activity'],
      },
      {
        id: 'organizations',
        name: 'Organizations',
        description: 'User organizations and teams',
        widgetTypes: ['gitea-organizations'],
      },
      {
        id: 'notifications',
        name: 'Notifications',
        description: 'User notification inbox',
        widgetTypes: ['gitea-notifications'],
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
          { name: 'username', type: 'string', required: true, description: 'Gitea username' },
        ],
      },
      {
        id: 'user-heatmap',
        name: 'Get User Heatmap',
        description: 'Get contribution heatmap for a user',
        method: 'GET',
        endpoint: '/users/{username}/heatmap',
        implemented: true,
        category: 'User',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Gitea username' },
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
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Page size (max 50)' },
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
      {
        id: 'repos-search',
        name: 'Search Repositories',
        description: 'Search for repositories',
        method: 'GET',
        endpoint: '/repos/search',
        implemented: true,
        category: 'Repositories',
        parameters: [
          { name: 'q', type: 'string', required: false, description: 'Search query' },
          { name: 'topic', type: 'boolean', required: false, description: 'Search topics' },
          { name: 'includeDesc', type: 'boolean', required: false, description: 'Include description' },
        ],
      },

      // Issues endpoints
      {
        id: 'issues-search',
        name: 'Search Issues',
        description: 'Search issues across repositories',
        method: 'GET',
        endpoint: '/repos/issues/search',
        implemented: true,
        category: 'Issues',
        parameters: [
          { name: 'state', type: 'string', required: false, description: 'open, closed, or all' },
          { name: 'labels', type: 'string', required: false, description: 'Comma-separated label names' },
          { name: 'type', type: 'string', required: false, description: 'issues or pulls' },
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
        ],
      },

      // Pull Request endpoints
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
        ],
      },

      // Organization endpoints
      {
        id: 'orgs-list-user',
        name: 'List User Organizations',
        description: 'List organizations for the authenticated user',
        method: 'GET',
        endpoint: '/user/orgs',
        implemented: true,
        category: 'Organizations',
      },
      {
        id: 'orgs-get',
        name: 'Get Organization',
        description: 'Get a specific organization',
        method: 'GET',
        endpoint: '/orgs/{org}',
        implemented: true,
        category: 'Organizations',
        parameters: [
          { name: 'org', type: 'string', required: true, description: 'Organization name' },
        ],
      },
      {
        id: 'orgs-teams',
        name: 'List Organization Teams',
        description: 'List teams for an organization',
        method: 'GET',
        endpoint: '/orgs/{org}/teams',
        implemented: true,
        category: 'Organizations',
        parameters: [
          { name: 'org', type: 'string', required: true, description: 'Organization name' },
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
          { name: 'status-types', type: 'array', required: false, description: 'Filter by status types' },
        ],
      },
      {
        id: 'notifications-new',
        name: 'Check New Notifications',
        description: 'Check for new unread notifications',
        method: 'GET',
        endpoint: '/notifications/new',
        implemented: true,
        category: 'Notifications',
      },
      {
        id: 'notifications-mark-read',
        name: 'Mark Notification as Read',
        description: 'Mark a notification thread as read',
        method: 'PATCH',
        endpoint: '/notifications/threads/{id}',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Notification thread ID' },
        ],
      },
    ];
  }
}
