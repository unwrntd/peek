import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  SonosConfig,
  SonosHousehold,
  SonosGroup,
  SonosPlayer,
  SonosPlaybackStatus,
  SonosPlaybackMetadata,
  SonosVolume,
  SonosFavorite,
  SonosPlaylist,
  SonosNowPlaying,
  SonosGroupsData,
} from '../types';
import { logger } from '../services/logger';

const API_BASE_URL = 'https://api.ws.sonos.com/control/api/v1';
const AUTH_URL = 'https://api.sonos.com/login/v3/oauth/access';

// Token cache to store access tokens
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
const tokenCache = new Map<string, TokenCache>();

export class SonosIntegration extends BaseIntegration {
  readonly type = 'sonos';
  readonly name = 'Sonos';

  private getCacheKey(config: SonosConfig): string {
    return `sonos_${config.clientId}_${config.refreshToken.substring(0, 20)}`;
  }

  private async getAccessToken(config: SonosConfig): Promise<string> {
    const cacheKey = this.getCacheKey(config);
    const cached = tokenCache.get(cacheKey);

    // Return cached token if still valid (with 5 minute buffer)
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.accessToken;
    }

    // Refresh the token
    try {
      const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

      const response = await axios.post(
        AUTH_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
        }
      );

      const data = response.data;
      const accessToken = data.access_token;
      const expiresIn = data.expires_in || 86400; // Default 24 hours

      // Cache the new token
      tokenCache.set(cacheKey, {
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      logger.debug('sonos', 'Refreshed access token');
      return accessToken;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('sonos', 'Failed to refresh access token', { error: errorMsg });
      throw new Error(`Failed to refresh access token: ${errorMsg}`);
    }
  }

  private async createClient(config: SonosConfig): Promise<AxiosInstance> {
    const accessToken = await this.getAccessToken(config);
    return axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const sonosConfig = config as SonosConfig;

    if (!sonosConfig.clientId) {
      return { success: false, message: 'Client ID is required' };
    }
    if (!sonosConfig.clientSecret) {
      return { success: false, message: 'Client Secret is required' };
    }
    if (!sonosConfig.refreshToken) {
      return { success: false, message: 'Refresh Token is required' };
    }

    try {
      const client = await this.createClient(sonosConfig);
      const response = await client.get('/households');

      const households = response.data.households || [];

      return {
        success: true,
        message: `Connected to Sonos - ${households.length} household(s) found`,
        details: {
          householdCount: households.length,
          households: households.map((h: SonosHousehold) => ({
            id: h.id,
            name: h.name,
          })),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('sonos', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Access token is invalid or expired. Please re-authenticate.',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access forbidden: Check your API permissions and scopes.',
          };
        }
        if (error.response?.status === 429) {
          return {
            success: false,
            message: 'Rate limit exceeded.',
          };
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          return {
            success: false,
            message: 'Connection failed: Unable to reach Sonos API.',
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
    const sonosConfig = config as SonosConfig;
    const client = await this.createClient(sonosConfig);

    switch (metric) {
      case 'groups':
        return this.getGroups(client, sonosConfig);
      case 'now-playing':
        return this.getNowPlaying(client, sonosConfig);
      case 'volume':
        return this.getVolume(client, sonosConfig);
      case 'favorites':
        return this.getFavorites(client, sonosConfig);
      case 'playlists':
        return this.getPlaylists(client, sonosConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getHouseholdId(client: AxiosInstance, config: SonosConfig): Promise<string> {
    if (config.householdId) {
      return config.householdId;
    }

    const response = await client.get('/households');
    const households = response.data.households || [];

    if (households.length === 0) {
      throw new Error('No Sonos households found');
    }

    return households[0].id;
  }

  private async getGroups(client: AxiosInstance, config: SonosConfig): Promise<IntegrationData> {
    try {
      const householdId = await this.getHouseholdId(client, config);

      // Get households
      const householdsResponse = await client.get('/households');
      const households: SonosHousehold[] = householdsResponse.data.households || [];

      // Get groups and players
      const groupsResponse = await client.get(`/households/${householdId}/groups`);
      const groups: SonosGroup[] = groupsResponse.data.groups || [];
      const players: SonosPlayer[] = groupsResponse.data.players || [];

      return { households, groups, players };
    } catch (error) {
      logger.error('sonos', 'Failed to get groups', { error });
      throw error;
    }
  }

  private async getNowPlaying(client: AxiosInstance, config: SonosConfig): Promise<IntegrationData> {
    try {
      const householdId = await this.getHouseholdId(client, config);
      const groupsResponse = await client.get(`/households/${householdId}/groups`);
      const groups: SonosGroup[] = groupsResponse.data.groups || [];
      const players: SonosPlayer[] = groupsResponse.data.players || [];

      const nowPlaying: SonosNowPlaying[] = [];

      for (const group of groups) {
        try {
          // Get playback status
          const playbackResponse = await client.get(`/groups/${group.id}/playback`);
          const playback: SonosPlaybackStatus = playbackResponse.data;

          // Get metadata
          let metadata: SonosPlaybackMetadata | null = null;
          try {
            const metadataResponse = await client.get(`/groups/${group.id}/playbackMetadata`);
            metadata = metadataResponse.data;
          } catch {
            // Metadata may not be available for all states
          }

          // Get volume
          let volume: SonosVolume | undefined;
          try {
            const volumeResponse = await client.get(`/groups/${group.id}/groupVolume`);
            volume = volumeResponse.data;
          } catch {
            // Volume may not be available
          }

          // Map player names
          const playerNames = group.playerIds
            .map(pid => players.find(p => p.id === pid)?.name || pid)
            .filter(Boolean);

          nowPlaying.push({
            groupId: group.id,
            groupName: group.name,
            playbackState: playback.playbackState,
            track: metadata?.currentItem?.track,
            positionMillis: playback.positionMillis,
            volume,
            players: playerNames,
          });
        } catch (groupError) {
          logger.debug('sonos', `Failed to get playback for group ${group.id}`, { error: groupError });
        }
      }

      return { nowPlaying };
    } catch (error) {
      logger.error('sonos', 'Failed to get now playing', { error });
      throw error;
    }
  }

  private async getVolume(client: AxiosInstance, config: SonosConfig): Promise<IntegrationData> {
    try {
      const householdId = await this.getHouseholdId(client, config);
      const groupsResponse = await client.get(`/households/${householdId}/groups`);
      const groups: SonosGroup[] = groupsResponse.data.groups || [];

      const volumes: Array<{ groupId: string; groupName: string; volume: SonosVolume }> = [];

      for (const group of groups) {
        try {
          const volumeResponse = await client.get(`/groups/${group.id}/groupVolume`);
          volumes.push({
            groupId: group.id,
            groupName: group.name,
            volume: volumeResponse.data,
          });
        } catch (volumeError) {
          logger.debug('sonos', `Failed to get volume for group ${group.id}`, { error: volumeError });
        }
      }

      return { volumes };
    } catch (error) {
      logger.error('sonos', 'Failed to get volume', { error });
      throw error;
    }
  }

  private async getFavorites(client: AxiosInstance, config: SonosConfig): Promise<IntegrationData> {
    try {
      const householdId = await this.getHouseholdId(client, config);

      // Get favorites
      const favResponse = await client.get(`/households/${householdId}/favorites`);
      const favorites: SonosFavorite[] = favResponse.data.items || [];

      // Also get groups so the widget knows where to play
      const groupsResponse = await client.get(`/households/${householdId}/groups`);
      const groups: SonosGroup[] = groupsResponse.data.groups || [];

      return { favorites, groups };
    } catch (error) {
      logger.error('sonos', 'Failed to get favorites', { error });
      throw error;
    }
  }

  private async getPlaylists(client: AxiosInstance, config: SonosConfig): Promise<IntegrationData> {
    try {
      const householdId = await this.getHouseholdId(client, config);

      // Get playlists
      const playlistResponse = await client.get(`/households/${householdId}/playlists`);
      const playlists: SonosPlaylist[] = playlistResponse.data.playlists || [];

      // Also get groups so the widget knows where to play
      const groupsResponse = await client.get(`/households/${householdId}/groups`);
      const groups: SonosGroup[] = groupsResponse.data.groups || [];

      return { playlists, groups };
    } catch (error) {
      logger.error('sonos', 'Failed to get playlists', { error });
      throw error;
    }
  }

  async performAction(
    config: IntegrationConfig,
    action: string,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; message?: string }> {
    const sonosConfig = config as SonosConfig;
    const client = await this.createClient(sonosConfig);
    const groupId = params.groupId as string;

    if (!groupId) {
      return { success: false, message: 'Group ID is required' };
    }

    try {
      switch (action) {
        case 'play': {
          await client.post(`/groups/${groupId}/playback/play`);
          return { success: true, message: 'Playing' };
        }
        case 'pause': {
          await client.post(`/groups/${groupId}/playback/pause`);
          return { success: true, message: 'Paused' };
        }
        case 'toggle': {
          await client.post(`/groups/${groupId}/playback/togglePlayPause`);
          return { success: true, message: 'Toggled playback' };
        }
        case 'next': {
          await client.post(`/groups/${groupId}/playback/skipToNextTrack`);
          return { success: true, message: 'Skipped to next' };
        }
        case 'previous': {
          await client.post(`/groups/${groupId}/playback/skipToPreviousTrack`);
          return { success: true, message: 'Skipped to previous' };
        }
        case 'setVolume': {
          const volume = params.volume as number;
          if (volume === undefined || volume < 0 || volume > 100) {
            return { success: false, message: 'Volume must be between 0 and 100' };
          }
          await client.post(`/groups/${groupId}/groupVolume`, { volume });
          return { success: true, message: `Volume set to ${volume}` };
        }
        case 'setMute': {
          const muted = params.muted as boolean;
          if (muted === undefined) {
            return { success: false, message: 'Muted state is required' };
          }
          await client.post(`/groups/${groupId}/groupVolume/mute`, { muted });
          return { success: true, message: muted ? 'Muted' : 'Unmuted' };
        }
        case 'loadFavorite': {
          const favoriteId = params.favoriteId as string;
          if (!favoriteId) {
            return { success: false, message: 'Favorite ID is required' };
          }
          const playOnCompletion = params.playOnCompletion !== false;
          await client.post(`/groups/${groupId}/favorites`, {
            favoriteId,
            playOnCompletion,
            action: 'REPLACE',
          });
          return { success: true, message: 'Favorite loaded' };
        }
        case 'loadPlaylist': {
          const playlistId = params.playlistId as string;
          if (!playlistId) {
            return { success: false, message: 'Playlist ID is required' };
          }
          const playOnCompletion = params.playOnCompletion !== false;
          await client.post(`/groups/${groupId}/playlists`, {
            playlistId,
            playOnCompletion,
            action: 'REPLACE',
          });
          return { success: true, message: 'Playlist loaded' };
        }
        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('sonos', 'Action failed', { action, error: errorMsg });
      return { success: false, message: errorMsg };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'groups',
        name: 'Groups & Players',
        description: 'Speaker groups and individual players',
        widgetTypes: ['sonos-groups', 'sonos-players'],
      },
      {
        id: 'now-playing',
        name: 'Now Playing',
        description: 'Current playback status and track info',
        widgetTypes: ['sonos-now-playing'],
      },
      {
        id: 'volume',
        name: 'Volume',
        description: 'Volume levels for all groups',
        widgetTypes: ['sonos-volume'],
      },
      {
        id: 'favorites',
        name: 'Favorites',
        description: 'Saved favorites',
        widgetTypes: ['sonos-favorites'],
      },
      {
        id: 'playlists',
        name: 'Playlists',
        description: 'Sonos playlists',
        widgetTypes: ['sonos-playlists'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Households - Implemented
      {
        id: 'households-get',
        name: 'Get Households',
        description: 'Get all households associated with the authenticated user account',
        method: 'GET',
        endpoint: '/households',
        implemented: true,
        category: 'Households',
        documentationUrl: 'https://developer.sonos.com/reference/control-api/households/',
      },

      // Groups - Implemented
      {
        id: 'groups-get',
        name: 'Get Groups',
        description: 'Get all groups and players in a household',
        method: 'GET',
        endpoint: '/households/{householdId}/groups',
        implemented: true,
        category: 'Groups',
        parameters: [
          { name: 'householdId', type: 'string', required: true, description: 'Household ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/groups/',
      },
      {
        id: 'groups-create',
        name: 'Create Group',
        description: 'Create a new group with the specified players',
        method: 'POST',
        endpoint: '/households/{householdId}/groups/createGroup',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'householdId', type: 'string', required: true, description: 'Household ID' },
          { name: 'playerIds', type: 'array', required: true, description: 'Array of player IDs to include in the group' },
          { name: 'musicContextGroupId', type: 'string', required: false, description: 'Group ID to copy music context from' },
        ],
      },
      {
        id: 'groups-modify-members',
        name: 'Modify Group Members',
        description: 'Add or remove players from a group',
        method: 'POST',
        endpoint: '/groups/{groupId}/groups/modifyGroupMembers',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'playerIdsToAdd', type: 'array', required: false, description: 'Player IDs to add' },
          { name: 'playerIdsToRemove', type: 'array', required: false, description: 'Player IDs to remove' },
        ],
      },
      {
        id: 'groups-set-members',
        name: 'Set Group Members',
        description: 'Set the exact list of players in a group',
        method: 'POST',
        endpoint: '/groups/{groupId}/groups/setGroupMembers',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'playerIds', type: 'array', required: true, description: 'Array of player IDs for the group' },
        ],
      },
      {
        id: 'groups-subscribe',
        name: 'Subscribe to Groups',
        description: 'Subscribe to group change events for a household',
        method: 'POST',
        endpoint: '/households/{householdId}/groups/subscribe',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'groups-unsubscribe',
        name: 'Unsubscribe from Groups',
        description: 'Unsubscribe from group change events',
        method: 'POST',
        endpoint: '/households/{householdId}/groups/unsubscribe',
        implemented: false,
        category: 'Groups',
      },

      // Playback - Partially Implemented
      {
        id: 'playback-get',
        name: 'Get Playback Status',
        description: 'Get current playback status for a group',
        method: 'GET',
        endpoint: '/groups/{groupId}/playback',
        implemented: true,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/playback/',
      },
      {
        id: 'playback-play',
        name: 'Play',
        description: 'Start or resume playback',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/play',
        implemented: true,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
      },
      {
        id: 'playback-pause',
        name: 'Pause',
        description: 'Pause playback',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/pause',
        implemented: true,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
      },
      {
        id: 'playback-toggle',
        name: 'Toggle Play/Pause',
        description: 'Toggle between play and pause states',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/togglePlayPause',
        implemented: true,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
      },
      {
        id: 'playback-skip-next',
        name: 'Skip to Next Track',
        description: 'Skip to the next track in the queue',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/skipToNextTrack',
        implemented: true,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
      },
      {
        id: 'playback-skip-previous',
        name: 'Skip to Previous Track',
        description: 'Skip to the previous track in the queue',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/skipToPreviousTrack',
        implemented: true,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
      },
      {
        id: 'playback-seek',
        name: 'Seek',
        description: 'Seek to a specific position in the current track',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/seek',
        implemented: false,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'positionMillis', type: 'number', required: true, description: 'Position in milliseconds' },
        ],
      },
      {
        id: 'playback-seek-relative',
        name: 'Seek Relative',
        description: 'Seek forward or backward by a relative amount',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/seekRelative',
        implemented: false,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'deltaMillis', type: 'number', required: true, description: 'Relative position change in milliseconds' },
        ],
      },
      {
        id: 'playback-set-play-modes',
        name: 'Set Play Modes',
        description: 'Set repeat and shuffle modes',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/playMode',
        implemented: false,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'playModes', type: 'object', required: true, description: 'Object with repeat, repeatOne, shuffle, crossfade' },
        ],
      },
      {
        id: 'playback-subscribe',
        name: 'Subscribe to Playback',
        description: 'Subscribe to playback state change events',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/subscribe',
        implemented: false,
        category: 'Playback',
      },
      {
        id: 'playback-unsubscribe',
        name: 'Unsubscribe from Playback',
        description: 'Unsubscribe from playback state change events',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/unsubscribe',
        implemented: false,
        category: 'Playback',
      },

      // Playback Metadata - Implemented
      {
        id: 'playback-metadata-get',
        name: 'Get Playback Metadata',
        description: 'Get metadata for current playback including track info and album art',
        method: 'GET',
        endpoint: '/groups/{groupId}/playbackMetadata',
        implemented: true,
        category: 'Playback Metadata',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/playbackMetadata/',
      },
      {
        id: 'playback-metadata-subscribe',
        name: 'Subscribe to Metadata',
        description: 'Subscribe to playback metadata change events',
        method: 'POST',
        endpoint: '/groups/{groupId}/playbackMetadata/subscribe',
        implemented: false,
        category: 'Playback Metadata',
      },
      {
        id: 'playback-metadata-unsubscribe',
        name: 'Unsubscribe from Metadata',
        description: 'Unsubscribe from playback metadata change events',
        method: 'POST',
        endpoint: '/groups/{groupId}/playbackMetadata/unsubscribe',
        implemented: false,
        category: 'Playback Metadata',
      },

      // Group Volume - Implemented
      {
        id: 'group-volume-get',
        name: 'Get Group Volume',
        description: 'Get volume level and mute state for a group',
        method: 'GET',
        endpoint: '/groups/{groupId}/groupVolume',
        implemented: true,
        category: 'Volume',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/groupVolume/',
      },
      {
        id: 'group-volume-set',
        name: 'Set Group Volume',
        description: 'Set volume level for a group',
        method: 'POST',
        endpoint: '/groups/{groupId}/groupVolume',
        implemented: true,
        category: 'Volume',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'volume', type: 'number', required: true, description: 'Volume level (0-100)' },
        ],
      },
      {
        id: 'group-volume-mute',
        name: 'Set Group Mute',
        description: 'Mute or unmute a group',
        method: 'POST',
        endpoint: '/groups/{groupId}/groupVolume/mute',
        implemented: true,
        category: 'Volume',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'muted', type: 'boolean', required: true, description: 'Mute state' },
        ],
      },
      {
        id: 'group-volume-relative',
        name: 'Set Group Volume Relative',
        description: 'Adjust group volume by a relative amount',
        method: 'POST',
        endpoint: '/groups/{groupId}/groupVolume/relative',
        implemented: false,
        category: 'Volume',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'volumeDelta', type: 'number', required: true, description: 'Volume change amount' },
        ],
      },
      {
        id: 'group-volume-subscribe',
        name: 'Subscribe to Group Volume',
        description: 'Subscribe to group volume change events',
        method: 'POST',
        endpoint: '/groups/{groupId}/groupVolume/subscribe',
        implemented: false,
        category: 'Volume',
      },
      {
        id: 'group-volume-unsubscribe',
        name: 'Unsubscribe from Group Volume',
        description: 'Unsubscribe from group volume change events',
        method: 'POST',
        endpoint: '/groups/{groupId}/groupVolume/unsubscribe',
        implemented: false,
        category: 'Volume',
      },

      // Player Volume - Not Implemented
      {
        id: 'player-volume-get',
        name: 'Get Player Volume',
        description: 'Get volume level and mute state for an individual player',
        method: 'GET',
        endpoint: '/players/{playerId}/playerVolume',
        implemented: false,
        category: 'Volume',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/playerVolume/',
      },
      {
        id: 'player-volume-set',
        name: 'Set Player Volume',
        description: 'Set volume level for an individual player',
        method: 'POST',
        endpoint: '/players/{playerId}/playerVolume',
        implemented: false,
        category: 'Volume',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
          { name: 'volume', type: 'number', required: true, description: 'Volume level (0-100)' },
        ],
      },
      {
        id: 'player-volume-mute',
        name: 'Set Player Mute',
        description: 'Mute or unmute an individual player',
        method: 'POST',
        endpoint: '/players/{playerId}/playerVolume/mute',
        implemented: false,
        category: 'Volume',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
          { name: 'muted', type: 'boolean', required: true, description: 'Mute state' },
        ],
      },
      {
        id: 'player-volume-subscribe',
        name: 'Subscribe to Player Volume',
        description: 'Subscribe to player volume change events',
        method: 'POST',
        endpoint: '/players/{playerId}/playerVolume/subscribe',
        implemented: false,
        category: 'Volume',
      },

      // Favorites - Implemented
      {
        id: 'favorites-get',
        name: 'Get Favorites',
        description: 'Get list of saved favorites for a household',
        method: 'GET',
        endpoint: '/households/{householdId}/favorites',
        implemented: true,
        category: 'Favorites',
        parameters: [
          { name: 'householdId', type: 'string', required: true, description: 'Household ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/favorites/',
      },
      {
        id: 'favorites-load',
        name: 'Load Favorite',
        description: 'Load a favorite to play on a group',
        method: 'POST',
        endpoint: '/groups/{groupId}/favorites',
        implemented: true,
        category: 'Favorites',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'favoriteId', type: 'string', required: true, description: 'Favorite ID' },
          { name: 'playOnCompletion', type: 'boolean', required: false, description: 'Start playback after loading' },
          { name: 'action', type: 'string', required: false, description: 'REPLACE, APPEND, or INSERT_NEXT' },
        ],
      },
      {
        id: 'favorites-subscribe',
        name: 'Subscribe to Favorites',
        description: 'Subscribe to favorites list change events',
        method: 'POST',
        endpoint: '/households/{householdId}/favorites/subscribe',
        implemented: false,
        category: 'Favorites',
      },
      {
        id: 'favorites-unsubscribe',
        name: 'Unsubscribe from Favorites',
        description: 'Unsubscribe from favorites list change events',
        method: 'POST',
        endpoint: '/households/{householdId}/favorites/unsubscribe',
        implemented: false,
        category: 'Favorites',
      },

      // Playlists - Implemented
      {
        id: 'playlists-get',
        name: 'Get Playlists',
        description: 'Get list of Sonos playlists for a household',
        method: 'GET',
        endpoint: '/households/{householdId}/playlists',
        implemented: true,
        category: 'Playlists',
        parameters: [
          { name: 'householdId', type: 'string', required: true, description: 'Household ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/playlists/',
      },
      {
        id: 'playlists-load',
        name: 'Load Playlist',
        description: 'Load a playlist to play on a group',
        method: 'POST',
        endpoint: '/groups/{groupId}/playlists',
        implemented: true,
        category: 'Playlists',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'playlistId', type: 'string', required: true, description: 'Playlist ID' },
          { name: 'playOnCompletion', type: 'boolean', required: false, description: 'Start playback after loading' },
          { name: 'action', type: 'string', required: false, description: 'REPLACE, APPEND, or INSERT_NEXT' },
        ],
      },
      {
        id: 'playlists-subscribe',
        name: 'Subscribe to Playlists',
        description: 'Subscribe to playlists list change events',
        method: 'POST',
        endpoint: '/households/{householdId}/playlists/subscribe',
        implemented: false,
        category: 'Playlists',
      },
      {
        id: 'playlists-get-tracks',
        name: 'Get Playlist Tracks',
        description: 'Get tracks in a specific playlist',
        method: 'POST',
        endpoint: '/households/{householdId}/playlists/getPlaylist',
        implemented: false,
        category: 'Playlists',
        parameters: [
          { name: 'householdId', type: 'string', required: true, description: 'Household ID' },
          { name: 'playlistId', type: 'string', required: true, description: 'Playlist ID' },
        ],
      },

      // Audio Clip
      {
        id: 'audioclip-load',
        name: 'Load Audio Clip',
        description: 'Play an audio clip (announcement, doorbell, etc.) on a player',
        method: 'POST',
        endpoint: '/players/{playerId}/audioClip',
        implemented: false,
        category: 'Audio Clip',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
          { name: 'appId', type: 'string', required: true, description: 'Application ID' },
          { name: 'name', type: 'string', required: true, description: 'Clip name for identification' },
          { name: 'streamUrl', type: 'string', required: false, description: 'URL of audio to play' },
          { name: 'clipType', type: 'string', required: false, description: 'CHIME or CUSTOM' },
          { name: 'priority', type: 'string', required: false, description: 'LOW or HIGH' },
          { name: 'volume', type: 'number', required: false, description: 'Volume for clip playback' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/audioclip/',
      },
      {
        id: 'audioclip-cancel',
        name: 'Cancel Audio Clip',
        description: 'Cancel a currently playing audio clip',
        method: 'DELETE',
        endpoint: '/players/{playerId}/audioClip/{id}',
        implemented: false,
        category: 'Audio Clip',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
          { name: 'id', type: 'string', required: true, description: 'Audio clip ID' },
        ],
      },
      {
        id: 'audioclip-subscribe',
        name: 'Subscribe to Audio Clips',
        description: 'Subscribe to audio clip status events',
        method: 'POST',
        endpoint: '/players/{playerId}/audioClip/subscribe',
        implemented: false,
        category: 'Audio Clip',
      },

      // Home Theater
      {
        id: 'hometheater-get-options',
        name: 'Get Home Theater Options',
        description: 'Get home theater settings for a player',
        method: 'GET',
        endpoint: '/players/{playerId}/homeTheater',
        implemented: false,
        category: 'Home Theater',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/homeTheater/',
      },
      {
        id: 'hometheater-set-options',
        name: 'Set Home Theater Options',
        description: 'Configure home theater settings (night mode, speech enhancement, etc.)',
        method: 'POST',
        endpoint: '/players/{playerId}/homeTheater',
        implemented: false,
        category: 'Home Theater',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
          { name: 'nightMode', type: 'boolean', required: false, description: 'Enable night mode' },
          { name: 'enhanceDialog', type: 'boolean', required: false, description: 'Enable speech enhancement' },
        ],
      },
      {
        id: 'hometheater-load-playback',
        name: 'Load Home Theater Playback',
        description: 'Switch to TV input on a home theater player',
        method: 'POST',
        endpoint: '/groups/{groupId}/homeTheater',
        implemented: false,
        category: 'Home Theater',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
        ],
      },
      {
        id: 'hometheater-set-tv-power',
        name: 'Set TV Power State',
        description: 'Turn TV on or off via CEC',
        method: 'POST',
        endpoint: '/players/{playerId}/homeTheater/tvPowerState',
        implemented: false,
        category: 'Home Theater',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
          { name: 'tvPowerState', type: 'string', required: true, description: 'ON or STANDBY' },
        ],
      },
      {
        id: 'hometheater-subscribe',
        name: 'Subscribe to Home Theater',
        description: 'Subscribe to home theater state change events',
        method: 'POST',
        endpoint: '/players/{playerId}/homeTheater/subscribe',
        implemented: false,
        category: 'Home Theater',
      },

      // Playback Session
      {
        id: 'playback-session-create',
        name: 'Create Playback Session',
        description: 'Create a cloud queue playback session',
        method: 'POST',
        endpoint: '/groups/{groupId}/playbackSession/createSession',
        implemented: false,
        category: 'Playback Session',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'appId', type: 'string', required: true, description: 'Application ID' },
          { name: 'appContext', type: 'string', required: false, description: 'Application context' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/playbackSession/',
      },
      {
        id: 'playback-session-join',
        name: 'Join Playback Session',
        description: 'Join an existing playback session',
        method: 'POST',
        endpoint: '/groups/{groupId}/playbackSession/joinSession',
        implemented: false,
        category: 'Playback Session',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'sessionId', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'playback-session-suspend',
        name: 'Suspend Playback Session',
        description: 'Suspend a playback session',
        method: 'POST',
        endpoint: '/playbackSessions/{sessionId}/playbackSession/suspend',
        implemented: false,
        category: 'Playback Session',
      },
      {
        id: 'playback-session-load-cloud-queue',
        name: 'Load Cloud Queue',
        description: 'Load a cloud queue for playback',
        method: 'POST',
        endpoint: '/playbackSessions/{sessionId}/playbackSession/loadCloudQueue',
        implemented: false,
        category: 'Playback Session',
        parameters: [
          { name: 'sessionId', type: 'string', required: true, description: 'Session ID' },
          { name: 'queueBaseUrl', type: 'string', required: true, description: 'Cloud queue URL' },
          { name: 'playOnCompletion', type: 'boolean', required: false, description: 'Start playback after loading' },
        ],
      },
      {
        id: 'playback-session-seek-cloud-queue',
        name: 'Seek Cloud Queue Item',
        description: 'Seek to a specific item in the cloud queue',
        method: 'POST',
        endpoint: '/playbackSessions/{sessionId}/playbackSession/seekCloudQueueItem',
        implemented: false,
        category: 'Playback Session',
      },
      {
        id: 'playback-session-skip-cloud-queue',
        name: 'Skip Cloud Queue Item',
        description: 'Skip forward or backward in the cloud queue',
        method: 'POST',
        endpoint: '/playbackSessions/{sessionId}/playbackSession/skipCloudQueueItem',
        implemented: false,
        category: 'Playback Session',
      },

      // Music Service Accounts
      {
        id: 'music-services-get',
        name: 'Get Music Service Accounts',
        description: 'Get list of music service accounts linked to the household',
        method: 'GET',
        endpoint: '/households/{householdId}/musicServiceAccounts',
        implemented: false,
        category: 'Music Services',
        parameters: [
          { name: 'householdId', type: 'string', required: true, description: 'Household ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/musicServiceAccounts/',
      },
      {
        id: 'music-services-match',
        name: 'Match Music Service',
        description: 'Match a service account by ID',
        method: 'POST',
        endpoint: '/households/{householdId}/musicServiceAccounts/match',
        implemented: false,
        category: 'Music Services',
      },
      {
        id: 'music-services-subscribe',
        name: 'Subscribe to Music Services',
        description: 'Subscribe to music service account change events',
        method: 'POST',
        endpoint: '/households/{householdId}/musicServiceAccounts/subscribe',
        implemented: false,
        category: 'Music Services',
      },

      // Settings
      {
        id: 'player-settings-get',
        name: 'Get Player Settings',
        description: 'Get settings for a player (name, icon, etc.)',
        method: 'GET',
        endpoint: '/players/{playerId}/settings/player',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
        ],
        documentationUrl: 'https://developer.sonos.com/reference/control-api/settings/',
      },
      {
        id: 'player-settings-set',
        name: 'Set Player Settings',
        description: 'Update settings for a player',
        method: 'POST',
        endpoint: '/players/{playerId}/settings/player',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'playerId', type: 'string', required: true, description: 'Player ID' },
          { name: 'name', type: 'string', required: false, description: 'Player name' },
          { name: 'icon', type: 'string', required: false, description: 'Player icon' },
        ],
      },
      {
        id: 'player-settings-subscribe',
        name: 'Subscribe to Player Settings',
        description: 'Subscribe to player settings change events',
        method: 'POST',
        endpoint: '/players/{playerId}/settings/player/subscribe',
        implemented: false,
        category: 'Settings',
      },

      // Load Stream URL
      {
        id: 'playback-load-stream',
        name: 'Load Stream URL',
        description: 'Load a live stream URL for playback',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/loadStreamUrl',
        implemented: false,
        category: 'Playback',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'streamUrl', type: 'string', required: true, description: 'URL of stream to play' },
          { name: 'playOnCompletion', type: 'boolean', required: false, description: 'Start playback after loading' },
          { name: 'stationMetadata', type: 'object', required: false, description: 'Station metadata (name, images)' },
        ],
      },

      // Line-In
      {
        id: 'linein-load',
        name: 'Load Line-In',
        description: 'Load line-in input from a player',
        method: 'POST',
        endpoint: '/groups/{groupId}/playback/lineIn',
        implemented: false,
        category: 'Line-In',
        parameters: [
          { name: 'groupId', type: 'string', required: true, description: 'Group ID' },
          { name: 'playerId', type: 'string', required: true, description: 'Player ID with line-in' },
          { name: 'playOnCompletion', type: 'boolean', required: false, description: 'Start playback after loading' },
        ],
      },
    ];
  }
}
