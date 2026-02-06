import axios, { AxiosInstance } from 'axios';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import {
  IntegrationData,
  SlackConfig,
  SlackTeam,
  SlackUser,
  SlackUserPresence,
  SlackChannel,
  SlackMessage,
} from '../types';
import { logger } from '../services/logger';

export class SlackIntegration extends BaseIntegration {
  readonly type = 'slack';
  readonly name = 'Slack';

  private createClient(config: SlackConfig): AxiosInstance {
    return axios.create({
      baseURL: 'https://slack.com/api',
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  async testConnection(config: SlackConfig): Promise<ConnectionTestResult> {
    try {
      const client = this.createClient(config);
      const response = await client.post('/auth.test');

      if (response.data?.ok) {
        const teamName = response.data.team || 'Unknown';
        const user = response.data.user || 'Unknown';
        return {
          success: true,
          message: `Connected to ${teamName} as ${user}`,
          details: {
            team: teamName,
            teamId: response.data.team_id,
            user: user,
            userId: response.data.user_id,
          },
        };
      }

      return {
        success: false,
        message: response.data?.error || 'Authentication failed',
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number; data?: { error?: string } } };
      logger.error('slack', 'Connection test failed', { error: err.message });

      if (err.response?.status === 401 || err.response?.data?.error === 'invalid_auth') {
        return {
          success: false,
          message: 'Invalid bot token',
        };
      }
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
      };
    }
  }

  async getData(config: SlackConfig, metric: string): Promise<IntegrationData> {
    const client = this.createClient(config);

    switch (metric) {
      case 'workspace':
        return this.getWorkspace(client);
      case 'users':
        return this.getUsers(client);
      case 'channels':
        return this.getChannels(client);
      case 'presence':
        return this.getPresence(client);
      case 'activity':
        return this.getActivity(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getWorkspace(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [authResp, teamResp, usersResp, channelsResp] = await Promise.all([
        client.post('/auth.test'),
        client.post('/team.info'),
        client.post('/users.list', { limit: 1000 }),
        client.post('/conversations.list', { types: 'public_channel,private_channel', limit: 1000 }),
      ]);

      const team: SlackTeam = teamResp.data?.team || {};
      const users = usersResp.data?.members || [];
      const channels = channelsResp.data?.channels || [];

      // Count active (non-deleted, non-bot) users
      const activeUsers = users.filter((u: SlackUser) => !u.deleted && !u.is_bot);
      const botUsers = users.filter((u: SlackUser) => u.is_bot && !u.deleted);

      return {
        team: {
          id: team.id,
          name: team.name,
          domain: team.domain,
          icon: team.icon?.image_132 || team.icon?.image_88 || team.icon?.image_68,
        },
        stats: {
          totalUsers: activeUsers.length,
          botUsers: botUsers.length,
          totalChannels: channels.length,
          publicChannels: channels.filter((c: SlackChannel) => !c.is_private).length,
          privateChannels: channels.filter((c: SlackChannel) => c.is_private).length,
        },
        botInfo: {
          user: authResp.data?.user,
          userId: authResp.data?.user_id,
        },
      };
    } catch (error) {
      logger.error('slack', 'Failed to get workspace info', { error });
      throw error;
    }
  }

  private async getUsers(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.post('/users.list', { limit: 1000 });

      if (!response.data?.ok) {
        throw new Error(response.data?.error || 'Failed to fetch users');
      }

      const members = response.data.members || [];
      const users: SlackUser[] = members
        .filter((u: SlackUser) => !u.deleted)
        .map((u: SlackUser) => ({
          id: u.id,
          team_id: u.team_id,
          name: u.name,
          deleted: u.deleted,
          real_name: u.real_name,
          profile: {
            title: u.profile?.title,
            email: u.profile?.email,
            display_name: u.profile?.display_name,
            status_text: u.profile?.status_text,
            status_emoji: u.profile?.status_emoji,
            image_48: u.profile?.image_48,
            image_72: u.profile?.image_72,
            image_192: u.profile?.image_192,
          },
          is_admin: u.is_admin,
          is_owner: u.is_owner,
          is_bot: u.is_bot,
          tz: u.tz,
          tz_label: u.tz_label,
        }));

      return {
        users,
        total: users.length,
        admins: users.filter(u => u.is_admin).length,
        bots: users.filter(u => u.is_bot).length,
      };
    } catch (error) {
      logger.error('slack', 'Failed to get users', { error });
      throw error;
    }
  }

  private async getChannels(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.post('/conversations.list', {
        types: 'public_channel,private_channel',
        limit: 1000,
        exclude_archived: true,
      });

      if (!response.data?.ok) {
        throw new Error(response.data?.error || 'Failed to fetch channels');
      }

      const channels: SlackChannel[] = (response.data.channels || []).map((c: SlackChannel) => ({
        id: c.id,
        name: c.name,
        is_channel: c.is_channel,
        is_group: c.is_group,
        is_private: c.is_private,
        is_archived: c.is_archived,
        is_general: c.is_general,
        is_member: c.is_member,
        created: c.created,
        topic: c.topic,
        purpose: c.purpose,
        num_members: c.num_members,
      }));

      return {
        channels,
        total: channels.length,
        publicCount: channels.filter(c => !c.is_private).length,
        privateCount: channels.filter(c => c.is_private).length,
      };
    } catch (error) {
      logger.error('slack', 'Failed to get channels', { error });
      throw error;
    }
  }

  private async getPresence(client: AxiosInstance): Promise<IntegrationData> {
    try {
      // Get users first
      const usersResp = await client.post('/users.list', { limit: 200 });

      if (!usersResp.data?.ok) {
        throw new Error(usersResp.data?.error || 'Failed to fetch users');
      }

      const members = usersResp.data.members || [];
      const activeUsers = members.filter((u: SlackUser) => !u.deleted && !u.is_bot);

      // Limit presence checks to avoid rate limits (Tier 4 = 100/min)
      const usersToCheck = activeUsers.slice(0, 50);
      const presencePromises = usersToCheck.map(async (user: SlackUser) => {
        try {
          const presenceResp = await client.post('/users.getPresence', { user: user.id });
          return {
            user: {
              id: user.id,
              name: user.name,
              real_name: user.real_name,
              profile: {
                display_name: user.profile?.display_name,
                status_text: user.profile?.status_text,
                status_emoji: user.profile?.status_emoji,
                image_48: user.profile?.image_48,
              },
            },
            presence: presenceResp.data?.presence || 'away',
            online: presenceResp.data?.online || false,
          };
        } catch {
          return {
            user: {
              id: user.id,
              name: user.name,
              real_name: user.real_name,
              profile: user.profile,
            },
            presence: 'unknown' as const,
            online: false,
          };
        }
      });

      const presenceResults = await Promise.all(presencePromises);
      const activeCount = presenceResults.filter(p => p.presence === 'active').length;
      const awayCount = presenceResults.filter(p => p.presence === 'away').length;

      return {
        users: presenceResults,
        total: presenceResults.length,
        active: activeCount,
        away: awayCount,
        totalInWorkspace: activeUsers.length,
      };
    } catch (error) {
      logger.error('slack', 'Failed to get presence', { error });
      throw error;
    }
  }

  private async getActivity(client: AxiosInstance): Promise<IntegrationData> {
    try {
      // Get channels the bot is a member of
      const channelsResp = await client.post('/conversations.list', {
        types: 'public_channel,private_channel',
        limit: 100,
        exclude_archived: true,
      });

      if (!channelsResp.data?.ok) {
        throw new Error(channelsResp.data?.error || 'Failed to fetch channels');
      }

      const channels = channelsResp.data.channels || [];
      const memberChannels = channels.filter((c: SlackChannel) => c.is_member);

      // Get recent messages from up to 5 channels
      const channelsToFetch = memberChannels.slice(0, 5);
      const messagesPromises = channelsToFetch.map(async (channel: SlackChannel) => {
        try {
          const historyResp = await client.post('/conversations.history', {
            channel: channel.id,
            limit: 10,
          });
          return {
            channel: {
              id: channel.id,
              name: channel.name,
            },
            messages: (historyResp.data?.messages || []).map((m: SlackMessage) => ({
              type: m.type,
              subtype: m.subtype,
              user: m.user,
              text: m.text,
              ts: m.ts,
              reactions: m.reactions,
            })),
          };
        } catch {
          return { channel: { id: channel.id, name: channel.name }, messages: [] };
        }
      });

      const channelMessages = await Promise.all(messagesPromises);

      // Flatten and sort by timestamp
      const allMessages = channelMessages
        .flatMap(cm => cm.messages.map((m: SlackMessage) => ({
          ...m,
          channel: cm.channel,
        })))
        .sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts))
        .slice(0, 25);

      // Get user info for message authors
      const userIds = [...new Set(allMessages.map(m => m.user).filter(Boolean))];
      const usersResp = await client.post('/users.list', { limit: 1000 });
      const users = usersResp.data?.members || [];
      const userMap = new Map(users.map((u: SlackUser) => [u.id, u]));

      const enrichedMessages = allMessages.map(m => ({
        ...m,
        userInfo: m.user ? {
          name: (userMap.get(m.user) as SlackUser)?.name,
          real_name: (userMap.get(m.user) as SlackUser)?.real_name,
          image_48: (userMap.get(m.user) as SlackUser)?.profile?.image_48,
        } : null,
      }));

      return {
        messages: enrichedMessages,
        total: enrichedMessages.length,
        channelsIncluded: channelMessages.map(cm => cm.channel),
      };
    } catch (error) {
      logger.error('slack', 'Failed to get activity', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'workspace',
        name: 'Workspace',
        description: 'Workspace info and quick stats',
        widgetTypes: ['slack-workspace'],
      },
      {
        id: 'users',
        name: 'Users',
        description: 'All users in workspace',
        widgetTypes: ['slack-users'],
      },
      {
        id: 'channels',
        name: 'Channels',
        description: 'List of channels',
        widgetTypes: ['slack-channels'],
      },
      {
        id: 'presence',
        name: 'Presence',
        description: 'Team presence overview',
        widgetTypes: ['slack-presence'],
      },
      {
        id: 'activity',
        name: 'Activity',
        description: 'Recent messages across channels',
        widgetTypes: ['slack-activity'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-test',
        name: 'Test Authentication',
        description: 'Test authentication and get basic info about the token',
        method: 'POST',
        endpoint: '/auth.test',
        implemented: true,
        category: 'Authentication',
        documentationUrl: 'https://api.slack.com/methods/auth.test',
      },

      // Team/Workspace
      {
        id: 'team-info',
        name: 'Get Team Info',
        description: 'Get information about the workspace',
        method: 'POST',
        endpoint: '/team.info',
        implemented: true,
        category: 'Team',
        documentationUrl: 'https://api.slack.com/methods/team.info',
      },
      {
        id: 'team-billing-info',
        name: 'Get Billing Info',
        description: 'Get billable user information for the workspace',
        method: 'POST',
        endpoint: '/team.billableInfo',
        implemented: false,
        category: 'Team',
        documentationUrl: 'https://api.slack.com/methods/team.billableInfo',
      },
      {
        id: 'team-access-logs',
        name: 'Get Access Logs',
        description: 'Get access logs for the workspace',
        method: 'POST',
        endpoint: '/team.accessLogs',
        implemented: false,
        category: 'Team',
        parameters: [
          { name: 'count', type: 'number', required: false, description: 'Number of items to return' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
        ],
        documentationUrl: 'https://api.slack.com/methods/team.accessLogs',
      },
      {
        id: 'team-integration-logs',
        name: 'Get Integration Logs',
        description: 'Get integration activity logs for the workspace',
        method: 'POST',
        endpoint: '/team.integrationLogs',
        implemented: false,
        category: 'Team',
        documentationUrl: 'https://api.slack.com/methods/team.integrationLogs',
      },

      // Users
      {
        id: 'users-list',
        name: 'List Users',
        description: 'List all users in the workspace',
        method: 'POST',
        endpoint: '/users.list',
        implemented: true,
        category: 'Users',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: 'Maximum number of users to return' },
          { name: 'cursor', type: 'string', required: false, description: 'Pagination cursor' },
          { name: 'include_locale', type: 'boolean', required: false, description: 'Include locale info' },
        ],
        documentationUrl: 'https://api.slack.com/methods/users.list',
      },
      {
        id: 'users-info',
        name: 'Get User Info',
        description: 'Get information about a specific user',
        method: 'POST',
        endpoint: '/users.info',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user', type: 'string', required: true, description: 'User ID' },
          { name: 'include_locale', type: 'boolean', required: false, description: 'Include locale info' },
        ],
        documentationUrl: 'https://api.slack.com/methods/users.info',
      },
      {
        id: 'users-get-presence',
        name: 'Get User Presence',
        description: 'Get presence information for a user',
        method: 'POST',
        endpoint: '/users.getPresence',
        implemented: true,
        category: 'Users',
        parameters: [
          { name: 'user', type: 'string', required: true, description: 'User ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/users.getPresence',
      },
      {
        id: 'users-set-presence',
        name: 'Set User Presence',
        description: 'Set presence for the authenticated user',
        method: 'POST',
        endpoint: '/users.setPresence',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'presence', type: 'string', required: true, description: 'Presence status (auto or away)' },
        ],
        documentationUrl: 'https://api.slack.com/methods/users.setPresence',
      },
      {
        id: 'users-profile-get',
        name: 'Get User Profile',
        description: "Get a user's profile information",
        method: 'POST',
        endpoint: '/users.profile.get',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user', type: 'string', required: false, description: 'User ID (defaults to authed user)' },
          { name: 'include_labels', type: 'boolean', required: false, description: 'Include labels' },
        ],
        documentationUrl: 'https://api.slack.com/methods/users.profile.get',
      },
      {
        id: 'users-profile-set',
        name: 'Set User Profile',
        description: "Set the user's profile information",
        method: 'POST',
        endpoint: '/users.profile.set',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'profile', type: 'object', required: false, description: 'Profile fields to set' },
          { name: 'user', type: 'string', required: false, description: 'User ID (admin only)' },
        ],
        documentationUrl: 'https://api.slack.com/methods/users.profile.set',
      },
      {
        id: 'users-lookup-by-email',
        name: 'Lookup User by Email',
        description: 'Find a user by email address',
        method: 'POST',
        endpoint: '/users.lookupByEmail',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'Email address' },
        ],
        documentationUrl: 'https://api.slack.com/methods/users.lookupByEmail',
      },

      // Conversations (Channels)
      {
        id: 'conversations-list',
        name: 'List Conversations',
        description: 'List all channels and conversations',
        method: 'POST',
        endpoint: '/conversations.list',
        implemented: true,
        category: 'Conversations',
        parameters: [
          { name: 'types', type: 'string', required: false, description: 'Channel types (public_channel, private_channel, mpim, im)' },
          { name: 'exclude_archived', type: 'boolean', required: false, description: 'Exclude archived channels' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum channels to return' },
          { name: 'cursor', type: 'string', required: false, description: 'Pagination cursor' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.list',
      },
      {
        id: 'conversations-info',
        name: 'Get Conversation Info',
        description: 'Get information about a channel',
        method: 'POST',
        endpoint: '/conversations.info',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'include_num_members', type: 'boolean', required: false, description: 'Include member count' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.info',
      },
      {
        id: 'conversations-history',
        name: 'Get Conversation History',
        description: 'Get message history from a channel',
        method: 'POST',
        endpoint: '/conversations.history',
        implemented: true,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum messages to return' },
          { name: 'cursor', type: 'string', required: false, description: 'Pagination cursor' },
          { name: 'oldest', type: 'string', required: false, description: 'Start of time range (timestamp)' },
          { name: 'latest', type: 'string', required: false, description: 'End of time range (timestamp)' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.history',
      },
      {
        id: 'conversations-members',
        name: 'Get Conversation Members',
        description: 'Get members of a channel',
        method: 'POST',
        endpoint: '/conversations.members',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum members to return' },
          { name: 'cursor', type: 'string', required: false, description: 'Pagination cursor' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.members',
      },
      {
        id: 'conversations-create',
        name: 'Create Conversation',
        description: 'Create a new channel',
        method: 'POST',
        endpoint: '/conversations.create',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Channel name' },
          { name: 'is_private', type: 'boolean', required: false, description: 'Create as private channel' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.create',
      },
      {
        id: 'conversations-join',
        name: 'Join Conversation',
        description: 'Join an existing conversation',
        method: 'POST',
        endpoint: '/conversations.join',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.join',
      },
      {
        id: 'conversations-leave',
        name: 'Leave Conversation',
        description: 'Leave a conversation',
        method: 'POST',
        endpoint: '/conversations.leave',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.leave',
      },
      {
        id: 'conversations-invite',
        name: 'Invite to Conversation',
        description: 'Invite users to a channel',
        method: 'POST',
        endpoint: '/conversations.invite',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'users', type: 'string', required: true, description: 'Comma-separated user IDs' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.invite',
      },
      {
        id: 'conversations-kick',
        name: 'Remove from Conversation',
        description: 'Remove a user from a channel',
        method: 'POST',
        endpoint: '/conversations.kick',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'user', type: 'string', required: true, description: 'User ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.kick',
      },
      {
        id: 'conversations-archive',
        name: 'Archive Conversation',
        description: 'Archive a channel',
        method: 'POST',
        endpoint: '/conversations.archive',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.archive',
      },
      {
        id: 'conversations-unarchive',
        name: 'Unarchive Conversation',
        description: 'Unarchive a channel',
        method: 'POST',
        endpoint: '/conversations.unarchive',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.unarchive',
      },
      {
        id: 'conversations-rename',
        name: 'Rename Conversation',
        description: 'Rename a channel',
        method: 'POST',
        endpoint: '/conversations.rename',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'name', type: 'string', required: true, description: 'New channel name' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.rename',
      },
      {
        id: 'conversations-set-topic',
        name: 'Set Conversation Topic',
        description: 'Set the topic for a channel',
        method: 'POST',
        endpoint: '/conversations.setTopic',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'topic', type: 'string', required: true, description: 'New topic' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.setTopic',
      },
      {
        id: 'conversations-set-purpose',
        name: 'Set Conversation Purpose',
        description: 'Set the purpose for a channel',
        method: 'POST',
        endpoint: '/conversations.setPurpose',
        implemented: false,
        category: 'Conversations',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'purpose', type: 'string', required: true, description: 'New purpose' },
        ],
        documentationUrl: 'https://api.slack.com/methods/conversations.setPurpose',
      },

      // Messages
      {
        id: 'chat-post-message',
        name: 'Post Message',
        description: 'Send a message to a channel',
        method: 'POST',
        endpoint: '/chat.postMessage',
        implemented: false,
        category: 'Messages',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'text', type: 'string', required: false, description: 'Message text' },
          { name: 'blocks', type: 'array', required: false, description: 'Block Kit blocks' },
          { name: 'thread_ts', type: 'string', required: false, description: 'Thread timestamp for replies' },
          { name: 'unfurl_links', type: 'boolean', required: false, description: 'Unfurl links' },
          { name: 'unfurl_media', type: 'boolean', required: false, description: 'Unfurl media' },
        ],
        documentationUrl: 'https://api.slack.com/methods/chat.postMessage',
      },
      {
        id: 'chat-update',
        name: 'Update Message',
        description: 'Update an existing message',
        method: 'POST',
        endpoint: '/chat.update',
        implemented: false,
        category: 'Messages',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'ts', type: 'string', required: true, description: 'Message timestamp' },
          { name: 'text', type: 'string', required: false, description: 'New message text' },
          { name: 'blocks', type: 'array', required: false, description: 'Block Kit blocks' },
        ],
        documentationUrl: 'https://api.slack.com/methods/chat.update',
      },
      {
        id: 'chat-delete',
        name: 'Delete Message',
        description: 'Delete a message',
        method: 'POST',
        endpoint: '/chat.delete',
        implemented: false,
        category: 'Messages',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'ts', type: 'string', required: true, description: 'Message timestamp' },
        ],
        documentationUrl: 'https://api.slack.com/methods/chat.delete',
      },
      {
        id: 'chat-get-permalink',
        name: 'Get Message Permalink',
        description: 'Get a permanent link to a message',
        method: 'POST',
        endpoint: '/chat.getPermalink',
        implemented: false,
        category: 'Messages',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'message_ts', type: 'string', required: true, description: 'Message timestamp' },
        ],
        documentationUrl: 'https://api.slack.com/methods/chat.getPermalink',
      },

      // Reactions
      {
        id: 'reactions-add',
        name: 'Add Reaction',
        description: 'Add a reaction to a message',
        method: 'POST',
        endpoint: '/reactions.add',
        implemented: false,
        category: 'Reactions',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'timestamp', type: 'string', required: true, description: 'Message timestamp' },
          { name: 'name', type: 'string', required: true, description: 'Emoji name' },
        ],
        documentationUrl: 'https://api.slack.com/methods/reactions.add',
      },
      {
        id: 'reactions-remove',
        name: 'Remove Reaction',
        description: 'Remove a reaction from a message',
        method: 'POST',
        endpoint: '/reactions.remove',
        implemented: false,
        category: 'Reactions',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'timestamp', type: 'string', required: true, description: 'Message timestamp' },
          { name: 'name', type: 'string', required: true, description: 'Emoji name' },
        ],
        documentationUrl: 'https://api.slack.com/methods/reactions.remove',
      },
      {
        id: 'reactions-get',
        name: 'Get Reactions',
        description: 'Get reactions for a message',
        method: 'POST',
        endpoint: '/reactions.get',
        implemented: false,
        category: 'Reactions',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'timestamp', type: 'string', required: true, description: 'Message timestamp' },
        ],
        documentationUrl: 'https://api.slack.com/methods/reactions.get',
      },
      {
        id: 'reactions-list',
        name: 'List Reactions',
        description: 'List reactions made by a user',
        method: 'POST',
        endpoint: '/reactions.list',
        implemented: false,
        category: 'Reactions',
        parameters: [
          { name: 'user', type: 'string', required: false, description: 'User ID' },
          { name: 'count', type: 'number', required: false, description: 'Number of items' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
        ],
        documentationUrl: 'https://api.slack.com/methods/reactions.list',
      },

      // Files
      {
        id: 'files-list',
        name: 'List Files',
        description: 'List files in the workspace',
        method: 'POST',
        endpoint: '/files.list',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'channel', type: 'string', required: false, description: 'Filter by channel' },
          { name: 'user', type: 'string', required: false, description: 'Filter by user' },
          { name: 'types', type: 'string', required: false, description: 'Filter by file types' },
          { name: 'count', type: 'number', required: false, description: 'Number of items' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
        ],
        documentationUrl: 'https://api.slack.com/methods/files.list',
      },
      {
        id: 'files-info',
        name: 'Get File Info',
        description: 'Get information about a file',
        method: 'POST',
        endpoint: '/files.info',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'file', type: 'string', required: true, description: 'File ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/files.info',
      },
      {
        id: 'files-upload',
        name: 'Upload File',
        description: 'Upload a file',
        method: 'POST',
        endpoint: '/files.upload',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'channels', type: 'string', required: false, description: 'Comma-separated channel IDs' },
          { name: 'content', type: 'string', required: false, description: 'File content' },
          { name: 'filename', type: 'string', required: false, description: 'Filename' },
          { name: 'title', type: 'string', required: false, description: 'File title' },
          { name: 'initial_comment', type: 'string', required: false, description: 'Initial comment' },
        ],
        documentationUrl: 'https://api.slack.com/methods/files.upload',
      },
      {
        id: 'files-delete',
        name: 'Delete File',
        description: 'Delete a file',
        method: 'POST',
        endpoint: '/files.delete',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'file', type: 'string', required: true, description: 'File ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/files.delete',
      },

      // Search
      {
        id: 'search-messages',
        name: 'Search Messages',
        description: 'Search for messages in the workspace',
        method: 'POST',
        endpoint: '/search.messages',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'count', type: 'number', required: false, description: 'Number of items' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'sort', type: 'string', required: false, description: 'Sort order (score or timestamp)' },
          { name: 'sort_dir', type: 'string', required: false, description: 'Sort direction (asc or desc)' },
        ],
        documentationUrl: 'https://api.slack.com/methods/search.messages',
      },
      {
        id: 'search-files',
        name: 'Search Files',
        description: 'Search for files in the workspace',
        method: 'POST',
        endpoint: '/search.files',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'count', type: 'number', required: false, description: 'Number of items' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
        ],
        documentationUrl: 'https://api.slack.com/methods/search.files',
      },

      // Emoji
      {
        id: 'emoji-list',
        name: 'List Custom Emoji',
        description: 'List custom emoji in the workspace',
        method: 'POST',
        endpoint: '/emoji.list',
        implemented: false,
        category: 'Emoji',
        documentationUrl: 'https://api.slack.com/methods/emoji.list',
      },

      // Pins
      {
        id: 'pins-add',
        name: 'Pin Message',
        description: 'Pin a message to a channel',
        method: 'POST',
        endpoint: '/pins.add',
        implemented: false,
        category: 'Pins',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'timestamp', type: 'string', required: true, description: 'Message timestamp' },
        ],
        documentationUrl: 'https://api.slack.com/methods/pins.add',
      },
      {
        id: 'pins-remove',
        name: 'Unpin Message',
        description: 'Unpin a message from a channel',
        method: 'POST',
        endpoint: '/pins.remove',
        implemented: false,
        category: 'Pins',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'timestamp', type: 'string', required: true, description: 'Message timestamp' },
        ],
        documentationUrl: 'https://api.slack.com/methods/pins.remove',
      },
      {
        id: 'pins-list',
        name: 'List Pins',
        description: 'List pinned messages in a channel',
        method: 'POST',
        endpoint: '/pins.list',
        implemented: false,
        category: 'Pins',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/pins.list',
      },

      // Bookmarks
      {
        id: 'bookmarks-list',
        name: 'List Bookmarks',
        description: 'List bookmarks in a channel',
        method: 'POST',
        endpoint: '/bookmarks.list',
        implemented: false,
        category: 'Bookmarks',
        parameters: [
          { name: 'channel_id', type: 'string', required: true, description: 'Channel ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/bookmarks.list',
      },
      {
        id: 'bookmarks-add',
        name: 'Add Bookmark',
        description: 'Add a bookmark to a channel',
        method: 'POST',
        endpoint: '/bookmarks.add',
        implemented: false,
        category: 'Bookmarks',
        parameters: [
          { name: 'channel_id', type: 'string', required: true, description: 'Channel ID' },
          { name: 'title', type: 'string', required: true, description: 'Bookmark title' },
          { name: 'type', type: 'string', required: true, description: 'Bookmark type (link)' },
          { name: 'link', type: 'string', required: false, description: 'Bookmark URL' },
        ],
        documentationUrl: 'https://api.slack.com/methods/bookmarks.add',
      },

      // Reminders
      {
        id: 'reminders-list',
        name: 'List Reminders',
        description: 'List reminders for the user',
        method: 'POST',
        endpoint: '/reminders.list',
        implemented: false,
        category: 'Reminders',
        documentationUrl: 'https://api.slack.com/methods/reminders.list',
      },
      {
        id: 'reminders-add',
        name: 'Add Reminder',
        description: 'Create a reminder',
        method: 'POST',
        endpoint: '/reminders.add',
        implemented: false,
        category: 'Reminders',
        parameters: [
          { name: 'text', type: 'string', required: true, description: 'Reminder text' },
          { name: 'time', type: 'string', required: true, description: 'When to remind (Unix timestamp or natural language)' },
          { name: 'user', type: 'string', required: false, description: 'User to remind (defaults to self)' },
        ],
        documentationUrl: 'https://api.slack.com/methods/reminders.add',
      },
      {
        id: 'reminders-delete',
        name: 'Delete Reminder',
        description: 'Delete a reminder',
        method: 'POST',
        endpoint: '/reminders.delete',
        implemented: false,
        category: 'Reminders',
        parameters: [
          { name: 'reminder', type: 'string', required: true, description: 'Reminder ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/reminders.delete',
      },

      // Do Not Disturb
      {
        id: 'dnd-info',
        name: 'Get DND Info',
        description: 'Get Do Not Disturb status for a user',
        method: 'POST',
        endpoint: '/dnd.info',
        implemented: false,
        category: 'Do Not Disturb',
        parameters: [
          { name: 'user', type: 'string', required: false, description: 'User ID' },
        ],
        documentationUrl: 'https://api.slack.com/methods/dnd.info',
      },
      {
        id: 'dnd-set-snooze',
        name: 'Set Snooze',
        description: 'Turn on Do Not Disturb for a period of time',
        method: 'POST',
        endpoint: '/dnd.setSnooze',
        implemented: false,
        category: 'Do Not Disturb',
        parameters: [
          { name: 'num_minutes', type: 'number', required: true, description: 'Number of minutes to snooze' },
        ],
        documentationUrl: 'https://api.slack.com/methods/dnd.setSnooze',
      },
      {
        id: 'dnd-end-snooze',
        name: 'End Snooze',
        description: 'Turn off Do Not Disturb',
        method: 'POST',
        endpoint: '/dnd.endSnooze',
        implemented: false,
        category: 'Do Not Disturb',
        documentationUrl: 'https://api.slack.com/methods/dnd.endSnooze',
      },
    ];
  }
}
