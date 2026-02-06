import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  DiscordConfig,
  DiscordUser,
  DiscordGuild,
  DiscordGuildMember,
  DiscordChannel,
  DiscordMessage,
  DiscordVoiceState,
  DiscordRole,
} from '../types';
import { logger } from '../services/logger';

// Discord channel types
const ChannelType = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GROUP_DM: 3,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  GUILD_STAGE_VOICE: 13,
  GUILD_DIRECTORY: 14,
  GUILD_FORUM: 15,
  GUILD_MEDIA: 16,
};

export class DiscordIntegration extends BaseIntegration {
  readonly type = 'discord';
  readonly name = 'Discord';

  private createClient(config: DiscordConfig): AxiosInstance {
    return axios.create({
      baseURL: 'https://discord.com/api/v10',
      headers: {
        'Authorization': `Bot ${config.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const discordConfig = config as DiscordConfig;

    if (!discordConfig.token) {
      return { success: false, message: 'Bot token is required' };
    }

    try {
      const client = this.createClient(discordConfig);

      // Get bot user info
      const userResponse = await client.get('/users/@me');
      const botUser: DiscordUser = userResponse.data;

      // Get guilds the bot is in
      const guildsResponse = await client.get('/users/@me/guilds');
      const guilds = guildsResponse.data || [];

      return {
        success: true,
        message: `Connected as ${botUser.username}`,
        details: {
          botId: botUser.id,
          botUsername: botUser.username,
          guildCount: guilds.length,
          guilds: guilds.slice(0, 5).map((g: DiscordGuild) => ({ id: g.id, name: g.name })),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('discord', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Invalid bot token',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access denied: Bot lacks required permissions',
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
    const discordConfig = config as DiscordConfig;
    const client = this.createClient(discordConfig);

    switch (metric) {
      case 'server':
        return this.getServer(client, discordConfig);
      case 'members':
        return this.getMembers(client, discordConfig);
      case 'channels':
        return this.getChannels(client, discordConfig);
      case 'activity':
        return this.getActivity(client, discordConfig);
      case 'voice':
        return this.getVoice(client, discordConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getServer(client: AxiosInstance, config: DiscordConfig): Promise<{
    guild: DiscordGuild | null;
    guilds: Array<{ id: string; name: string; icon?: string }>;
    botUser: DiscordUser;
  }> {
    try {
      const [userResponse, guildsResponse] = await Promise.all([
        client.get('/users/@me'),
        client.get('/users/@me/guilds'),
      ]);

      const botUser: DiscordUser = userResponse.data;
      const guilds = guildsResponse.data || [];

      let guild: DiscordGuild | null = null;
      if (config.guildId) {
        try {
          const guildResponse = await client.get(`/guilds/${config.guildId}`, {
            params: { with_counts: true },
          });
          guild = guildResponse.data;
        } catch {
          logger.warn('discord', 'Failed to fetch guild', { guildId: config.guildId });
        }
      }

      return { guild, guilds, botUser };
    } catch (error) {
      logger.error('discord', 'Failed to get server info', { error });
      throw error;
    }
  }

  private async getMembers(client: AxiosInstance, config: DiscordConfig): Promise<{
    members: DiscordGuildMember[];
    roles: DiscordRole[];
    guildId: string | null;
  }> {
    if (!config.guildId) {
      return { members: [], roles: [], guildId: null };
    }

    try {
      const [membersResponse, rolesResponse] = await Promise.all([
        client.get(`/guilds/${config.guildId}/members`, {
          params: { limit: 100 },
        }),
        client.get(`/guilds/${config.guildId}/roles`),
      ]);

      return {
        members: membersResponse.data || [],
        roles: rolesResponse.data || [],
        guildId: config.guildId,
      };
    } catch (error) {
      logger.error('discord', 'Failed to get members', { error });
      throw error;
    }
  }

  private async getChannels(client: AxiosInstance, config: DiscordConfig): Promise<{
    channels: DiscordChannel[];
    guildId: string | null;
  }> {
    if (!config.guildId) {
      return { channels: [], guildId: null };
    }

    try {
      const response = await client.get(`/guilds/${config.guildId}/channels`);
      const channels: DiscordChannel[] = response.data || [];

      // Sort by position
      channels.sort((a, b) => (a.position || 0) - (b.position || 0));

      return { channels, guildId: config.guildId };
    } catch (error) {
      logger.error('discord', 'Failed to get channels', { error });
      throw error;
    }
  }

  private async getActivity(client: AxiosInstance, config: DiscordConfig): Promise<{
    messages: DiscordMessage[];
    channels: DiscordChannel[];
    guildId: string | null;
  }> {
    if (!config.guildId) {
      return { messages: [], channels: [], guildId: null };
    }

    try {
      // Get channels first
      const channelsResponse = await client.get(`/guilds/${config.guildId}/channels`);
      const channels: DiscordChannel[] = channelsResponse.data || [];

      // Get text channels only
      const textChannels = channels.filter(
        (c) => c.type === ChannelType.GUILD_TEXT || c.type === ChannelType.GUILD_ANNOUNCEMENT
      );

      // Fetch recent messages from first few text channels
      const messages: DiscordMessage[] = [];
      for (const channel of textChannels.slice(0, 5)) {
        try {
          const messagesResponse = await client.get(`/channels/${channel.id}/messages`, {
            params: { limit: 10 },
          });
          const channelMessages = messagesResponse.data || [];
          messages.push(...channelMessages.map((m: DiscordMessage) => ({
            ...m,
            _channelName: channel.name,
          })));
        } catch {
          // Skip channels we can't read
        }
      }

      // Sort by timestamp descending
      messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return { messages: messages.slice(0, 50), channels: textChannels, guildId: config.guildId };
    } catch (error) {
      logger.error('discord', 'Failed to get activity', { error });
      throw error;
    }
  }

  private async getVoice(client: AxiosInstance, config: DiscordConfig): Promise<{
    voiceStates: DiscordVoiceState[];
    voiceChannels: DiscordChannel[];
    guildId: string | null;
  }> {
    if (!config.guildId) {
      return { voiceStates: [], voiceChannels: [], guildId: null };
    }

    try {
      // Get channels
      const channelsResponse = await client.get(`/guilds/${config.guildId}/channels`);
      const channels: DiscordChannel[] = channelsResponse.data || [];

      // Filter to voice channels
      const voiceChannels = channels.filter(
        (c) => c.type === ChannelType.GUILD_VOICE || c.type === ChannelType.GUILD_STAGE_VOICE
      );

      // Get guild with voice states (requires gateway, so this may be limited)
      // Note: REST API doesn't provide voice states directly, would need gateway connection
      // For now, return empty voice states
      const voiceStates: DiscordVoiceState[] = [];

      return { voiceStates, voiceChannels, guildId: config.guildId };
    } catch (error) {
      logger.error('discord', 'Failed to get voice', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'server',
        name: 'Server Info',
        description: 'Server overview and bot status',
        widgetTypes: ['discord-server'],
      },
      {
        id: 'members',
        name: 'Members',
        description: 'Server member list',
        widgetTypes: ['discord-members'],
      },
      {
        id: 'channels',
        name: 'Channels',
        description: 'Server channel list',
        widgetTypes: ['discord-channels'],
      },
      {
        id: 'activity',
        name: 'Activity',
        description: 'Recent messages',
        widgetTypes: ['discord-activity'],
      },
      {
        id: 'voice',
        name: 'Voice',
        description: 'Voice channel status',
        widgetTypes: ['discord-voice'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Users
      {
        id: 'get-current-user',
        name: 'Get Current User',
        description: 'Get the bot user info',
        method: 'GET',
        endpoint: '/users/@me',
        implemented: true,
        category: 'Users',
        documentationUrl: 'https://discord.com/developers/docs/resources/user#get-current-user',
      },
      {
        id: 'get-user',
        name: 'Get User',
        description: 'Get a user by ID',
        method: 'GET',
        endpoint: '/users/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'string', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'get-current-user-guilds',
        name: 'Get Current User Guilds',
        description: 'Get guilds the bot is a member of',
        method: 'GET',
        endpoint: '/users/@me/guilds',
        implemented: true,
        category: 'Users',
      },

      // Guilds
      {
        id: 'get-guild',
        name: 'Get Guild',
        description: 'Get guild (server) information',
        method: 'GET',
        endpoint: '/guilds/{guildId}',
        implemented: true,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
          { name: 'with_counts', type: 'boolean', required: false, description: 'Include member counts' },
        ],
        documentationUrl: 'https://discord.com/developers/docs/resources/guild#get-guild',
      },
      {
        id: 'get-guild-preview',
        name: 'Get Guild Preview',
        description: 'Get guild preview (public info)',
        method: 'GET',
        endpoint: '/guilds/{guildId}/preview',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-channels',
        name: 'Get Guild Channels',
        description: 'Get all channels in a guild',
        method: 'GET',
        endpoint: '/guilds/{guildId}/channels',
        implemented: true,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-members',
        name: 'List Guild Members',
        description: 'Get members in a guild (requires GUILD_MEMBERS intent)',
        method: 'GET',
        endpoint: '/guilds/{guildId}/members',
        implemented: true,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
          { name: 'limit', type: 'number', required: false, description: 'Max members to return (1-1000)' },
          { name: 'after', type: 'string', required: false, description: 'Get members after this user ID' },
        ],
      },
      {
        id: 'get-guild-member',
        name: 'Get Guild Member',
        description: 'Get a specific guild member',
        method: 'GET',
        endpoint: '/guilds/{guildId}/members/{userId}',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
          { name: 'userId', type: 'string', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'search-guild-members',
        name: 'Search Guild Members',
        description: 'Search for guild members by username or nickname',
        method: 'GET',
        endpoint: '/guilds/{guildId}/members/search',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'limit', type: 'number', required: false, description: 'Max results (1-1000)' },
        ],
      },
      {
        id: 'get-guild-roles',
        name: 'Get Guild Roles',
        description: 'Get all roles in a guild',
        method: 'GET',
        endpoint: '/guilds/{guildId}/roles',
        implemented: true,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-bans',
        name: 'Get Guild Bans',
        description: 'Get list of banned users',
        method: 'GET',
        endpoint: '/guilds/{guildId}/bans',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-emojis',
        name: 'List Guild Emojis',
        description: 'Get custom emojis in a guild',
        method: 'GET',
        endpoint: '/guilds/{guildId}/emojis',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-invites',
        name: 'Get Guild Invites',
        description: 'Get all invites for a guild',
        method: 'GET',
        endpoint: '/guilds/{guildId}/invites',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-integrations',
        name: 'Get Guild Integrations',
        description: 'Get guild integrations (Twitch, YouTube, etc.)',
        method: 'GET',
        endpoint: '/guilds/{guildId}/integrations',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-webhooks',
        name: 'Get Guild Webhooks',
        description: 'Get all webhooks in a guild',
        method: 'GET',
        endpoint: '/guilds/{guildId}/webhooks',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-guild-audit-log',
        name: 'Get Guild Audit Log',
        description: 'Get audit log entries',
        method: 'GET',
        endpoint: '/guilds/{guildId}/audit-logs',
        implemented: false,
        category: 'Guilds',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
          { name: 'limit', type: 'number', required: false, description: 'Max entries (1-100)' },
        ],
      },

      // Channels
      {
        id: 'get-channel',
        name: 'Get Channel',
        description: 'Get a channel by ID',
        method: 'GET',
        endpoint: '/channels/{channelId}',
        implemented: false,
        category: 'Channels',
        parameters: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
        ],
      },
      {
        id: 'get-channel-messages',
        name: 'Get Channel Messages',
        description: 'Get messages in a channel',
        method: 'GET',
        endpoint: '/channels/{channelId}/messages',
        implemented: true,
        category: 'Channels',
        parameters: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
          { name: 'limit', type: 'number', required: false, description: 'Max messages (1-100)' },
          { name: 'before', type: 'string', required: false, description: 'Get messages before this ID' },
          { name: 'after', type: 'string', required: false, description: 'Get messages after this ID' },
        ],
        documentationUrl: 'https://discord.com/developers/docs/resources/channel#get-channel-messages',
      },
      {
        id: 'get-channel-message',
        name: 'Get Channel Message',
        description: 'Get a specific message',
        method: 'GET',
        endpoint: '/channels/{channelId}/messages/{messageId}',
        implemented: false,
        category: 'Channels',
        parameters: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
          { name: 'messageId', type: 'string', required: true, description: 'Message ID' },
        ],
      },
      {
        id: 'create-message',
        name: 'Create Message',
        description: 'Send a message to a channel',
        method: 'POST',
        endpoint: '/channels/{channelId}/messages',
        implemented: false,
        category: 'Channels',
        parameters: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
          { name: 'content', type: 'string', required: true, description: 'Message content' },
        ],
      },
      {
        id: 'get-channel-pins',
        name: 'Get Pinned Messages',
        description: 'Get pinned messages in a channel',
        method: 'GET',
        endpoint: '/channels/{channelId}/pins',
        implemented: false,
        category: 'Channels',
        parameters: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
        ],
      },
      {
        id: 'get-channel-invites',
        name: 'Get Channel Invites',
        description: 'Get invites for a channel',
        method: 'GET',
        endpoint: '/channels/{channelId}/invites',
        implemented: false,
        category: 'Channels',
        parameters: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
        ],
      },
      {
        id: 'get-channel-webhooks',
        name: 'Get Channel Webhooks',
        description: 'Get webhooks for a channel',
        method: 'GET',
        endpoint: '/channels/{channelId}/webhooks',
        implemented: false,
        category: 'Channels',
        parameters: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
        ],
      },

      // Voice
      {
        id: 'list-voice-regions',
        name: 'List Voice Regions',
        description: 'Get available voice regions',
        method: 'GET',
        endpoint: '/voice/regions',
        implemented: false,
        category: 'Voice',
      },

      // Gateway
      {
        id: 'get-gateway',
        name: 'Get Gateway',
        description: 'Get WebSocket gateway URL',
        method: 'GET',
        endpoint: '/gateway',
        implemented: false,
        category: 'Gateway',
      },
      {
        id: 'get-gateway-bot',
        name: 'Get Gateway Bot',
        description: 'Get gateway URL and shard info',
        method: 'GET',
        endpoint: '/gateway/bot',
        implemented: false,
        category: 'Gateway',
      },

      // Invites
      {
        id: 'get-invite',
        name: 'Get Invite',
        description: 'Get invite by code',
        method: 'GET',
        endpoint: '/invites/{inviteCode}',
        implemented: false,
        category: 'Invites',
        parameters: [
          { name: 'inviteCode', type: 'string', required: true, description: 'Invite code' },
        ],
      },

      // Stickers
      {
        id: 'get-sticker',
        name: 'Get Sticker',
        description: 'Get a sticker by ID',
        method: 'GET',
        endpoint: '/stickers/{stickerId}',
        implemented: false,
        category: 'Stickers',
        parameters: [
          { name: 'stickerId', type: 'string', required: true, description: 'Sticker ID' },
        ],
      },
      {
        id: 'list-sticker-packs',
        name: 'List Sticker Packs',
        description: 'Get available Nitro sticker packs',
        method: 'GET',
        endpoint: '/sticker-packs',
        implemented: false,
        category: 'Stickers',
      },
      {
        id: 'list-guild-stickers',
        name: 'List Guild Stickers',
        description: 'Get custom stickers in a guild',
        method: 'GET',
        endpoint: '/guilds/{guildId}/stickers',
        implemented: false,
        category: 'Stickers',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },

      // Scheduled Events
      {
        id: 'list-scheduled-events',
        name: 'List Scheduled Events',
        description: 'Get scheduled events in a guild',
        method: 'GET',
        endpoint: '/guilds/{guildId}/scheduled-events',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
      {
        id: 'get-scheduled-event',
        name: 'Get Scheduled Event',
        description: 'Get a scheduled event',
        method: 'GET',
        endpoint: '/guilds/{guildId}/scheduled-events/{eventId}',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
          { name: 'eventId', type: 'string', required: true, description: 'Event ID' },
        ],
      },

      // Application Commands
      {
        id: 'get-global-commands',
        name: 'Get Global Application Commands',
        description: 'Get bot\'s global slash commands',
        method: 'GET',
        endpoint: '/applications/{applicationId}/commands',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'applicationId', type: 'string', required: true, description: 'Application ID' },
        ],
      },
      {
        id: 'get-guild-commands',
        name: 'Get Guild Application Commands',
        description: 'Get bot\'s slash commands for a guild',
        method: 'GET',
        endpoint: '/applications/{applicationId}/guilds/{guildId}/commands',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'applicationId', type: 'string', required: true, description: 'Application ID' },
          { name: 'guildId', type: 'string', required: true, description: 'Guild ID' },
        ],
      },
    ];
  }
}
