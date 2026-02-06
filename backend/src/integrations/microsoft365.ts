import axios, { AxiosInstance } from 'axios';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import { IntegrationData, Microsoft365Config } from '../types';

// Token cache to avoid unnecessary refreshes
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export class Microsoft365Integration extends BaseIntegration {
  readonly type = 'microsoft365';
  readonly name = 'Microsoft 365';

  private async getAccessToken(config: Microsoft365Config): Promise<string> {
    const cacheKey = `${config.tenantId}:${config.clientId}`;
    const cached = tokenCache.get(cacheKey);

    // Return cached token if still valid (with 1 minute buffer)
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    // Refresh the token
    const response = await axios.post(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default offline_access',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, expires_in } = response.data;

    tokenCache.set(cacheKey, {
      accessToken: access_token,
      expiresAt: Date.now() + expires_in * 1000,
    });

    return access_token;
  }

  private createClient(config: Microsoft365Config): AxiosInstance {
    // This method creates a client without the token - used for capability execution
    // The actual token will be added in graphRequest
    return axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async graphRequest<T>(config: Microsoft365Config, endpoint: string): Promise<T> {
    const token = await this.getAccessToken(config);
    const response = await axios.get<T>(
      `https://graph.microsoft.com/v1.0${endpoint}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  async testConnection(config: Microsoft365Config): Promise<ConnectionTestResult> {
    try {
      const profile = await this.graphRequest<{ displayName: string; mail: string }>(
        config,
        '/me'
      );

      return {
        success: true,
        message: `Connected as ${profile.displayName} (${profile.mail})`,
        details: { displayName: profile.displayName, mail: profile.mail },
      };
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status?: number; data?: { error?: { message?: string } } };
      };

      if (err.response?.status === 401) {
        return {
          success: false,
          message: 'Authentication failed. Please check your credentials or refresh token.',
        };
      }

      return {
        success: false,
        message: `Connection failed: ${err.response?.data?.error?.message || err.message}`,
      };
    }
  }

  async getData(config: Microsoft365Config, metric: string): Promise<IntegrationData> {
    switch (metric) {
      case 'mail':
        return this.getMail(config);
      case 'calendar':
        return this.getCalendar(config);
      case 'onedrive':
        return this.getOneDrive(config);
      case 'teams':
        return this.getTeams(config);
      case 'tasks':
        return this.getTasks(config);
      case 'profile':
        return this.getProfile(config);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getMail(config: Microsoft365Config): Promise<IntegrationData> {
    const [inboxResp, messagesResp] = await Promise.all([
      this.graphRequest<{
        unreadItemCount: number;
        totalItemCount: number;
      }>(config, '/me/mailFolders/Inbox'),
      this.graphRequest<{
        value: Array<{
          id: string;
          subject: string;
          from?: { emailAddress: { name: string; address: string } };
          receivedDateTime: string;
          isRead: boolean;
          hasAttachments: boolean;
          bodyPreview: string;
          importance: string;
        }>;
      }>(config, '/me/messages?$top=10&$orderby=receivedDateTime desc'),
    ]);

    return {
      unreadCount: inboxResp.unreadItemCount,
      totalCount: inboxResp.totalItemCount,
      recentMessages: messagesResp.value.map((msg) => ({
        id: msg.id,
        subject: msg.subject || '(No subject)',
        from: {
          name: msg.from?.emailAddress?.name || 'Unknown',
          email: msg.from?.emailAddress?.address || '',
        },
        receivedDateTime: msg.receivedDateTime,
        isRead: msg.isRead,
        hasAttachments: msg.hasAttachments,
        preview: msg.bodyPreview,
        importance: msg.importance,
      })),
    };
  }

  private async getCalendar(config: Microsoft365Config): Promise<IntegrationData> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [todayResp, weekResp] = await Promise.all([
      this.graphRequest<{
        value: Array<{
          id: string;
          subject: string;
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
          location?: { displayName: string };
          isAllDay: boolean;
          showAs: string;
          organizer?: { emailAddress: { name: string; address: string } };
          attendees?: Array<{
            emailAddress: { name: string; address: string };
            status: { response: string };
          }>;
          isOnlineMeeting: boolean;
          onlineMeetingUrl?: string;
        }>;
      }>(
        config,
        `/me/calendarView?startDateTime=${startOfDay.toISOString()}&endDateTime=${endOfDay.toISOString()}&$orderby=start/dateTime`
      ),
      this.graphRequest<{
        value: Array<{
          id: string;
          subject: string;
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
          location?: { displayName: string };
          isAllDay: boolean;
          showAs: string;
          isOnlineMeeting: boolean;
          onlineMeetingUrl?: string;
        }>;
      }>(
        config,
        `/me/calendarView?startDateTime=${now.toISOString()}&endDateTime=${endOfWeek.toISOString()}&$orderby=start/dateTime&$top=20`
      ),
    ]);

    const mapEvent = (event: {
      id: string;
      subject: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      location?: { displayName: string };
      isAllDay: boolean;
      showAs: string;
      organizer?: { emailAddress: { name: string; address: string } };
      attendees?: Array<{
        emailAddress: { name: string; address: string };
        status: { response: string };
      }>;
      isOnlineMeeting: boolean;
      onlineMeetingUrl?: string;
    }) => ({
      id: event.id,
      subject: event.subject || '(No title)',
      start: event.start,
      end: event.end,
      location: event.location?.displayName,
      isAllDay: event.isAllDay,
      showAs: event.showAs,
      organizer: event.organizer
        ? {
            name: event.organizer.emailAddress.name,
            email: event.organizer.emailAddress.address,
          }
        : undefined,
      attendees: event.attendees?.map((a) => ({
        name: a.emailAddress.name,
        email: a.emailAddress.address,
        response: a.status.response,
      })),
      isOnlineMeeting: event.isOnlineMeeting,
      onlineMeetingUrl: event.onlineMeetingUrl,
    });

    const todayEvents = todayResp.value.map(mapEvent);
    const upcomingEvents = weekResp.value.map(mapEvent);

    // Find next meeting (first non-all-day event that hasn't ended)
    const nextMeeting = upcomingEvents.find(
      (e) => !e.isAllDay && new Date(e.end.dateTime) > now
    );

    return {
      todayEvents,
      upcomingEvents,
      stats: {
        todayCount: todayEvents.length,
        weekCount: upcomingEvents.length,
        nextMeeting,
      },
    };
  }

  private async getOneDrive(config: Microsoft365Config): Promise<IntegrationData> {
    const [driveResp, recentResp] = await Promise.all([
      this.graphRequest<{
        owner: { user: { displayName: string; email: string } };
        quota: {
          total: number;
          used: number;
          remaining: number;
          deleted: number;
          state: string;
        };
      }>(config, '/me/drive'),
      this.graphRequest<{
        value: Array<{
          id: string;
          name: string;
          size?: number;
          lastModifiedDateTime: string;
          webUrl: string;
          folder?: { childCount: number };
          file?: { mimeType: string };
          createdBy?: { user: { displayName: string } };
        }>;
      }>(config, '/me/drive/recent?$top=10'),
    ]);

    return {
      user: {
        displayName: driveResp.owner?.user?.displayName,
        email: driveResp.owner?.user?.email,
      },
      quota: {
        total: driveResp.quota.total,
        used: driveResp.quota.used,
        remaining: driveResp.quota.remaining,
        deleted: driveResp.quota.deleted,
        state: driveResp.quota.state,
        percentUsed: Math.round((driveResp.quota.used / driveResp.quota.total) * 100),
      },
      recentFiles: recentResp.value.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        isFolder: !!item.folder,
        childCount: item.folder?.childCount,
        mimeType: item.file?.mimeType,
        createdBy: item.createdBy?.user?.displayName,
      })),
    };
  }

  private async getTeams(config: Microsoft365Config): Promise<IntegrationData> {
    try {
      const teamsResp = await this.graphRequest<{
        value: Array<{
          id: string;
          displayName: string;
          description?: string;
        }>;
      }>(config, '/me/joinedTeams');

      const teams = teamsResp.value;

      // Get channels for first 5 teams (to avoid rate limits)
      const teamsWithChannels = await Promise.all(
        teams.slice(0, 5).map(async (team) => {
          try {
            const channelsResp = await this.graphRequest<{
              value: Array<{
                id: string;
                displayName: string;
                membershipType: string;
              }>;
            }>(config, `/teams/${team.id}/channels`);

            return {
              id: team.id,
              displayName: team.displayName,
              description: team.description,
              channels: channelsResp.value.map((ch) => ({
                id: ch.id,
                displayName: ch.displayName,
                membershipType: ch.membershipType,
              })),
            };
          } catch {
            return {
              id: team.id,
              displayName: team.displayName,
              description: team.description,
              channels: [],
            };
          }
        })
      );

      // Try to get unread chats count
      let unreadChats = 0;
      try {
        const chatsResp = await this.graphRequest<{
          value: Array<{ unreadCount?: number }>;
        }>(config, '/me/chats?$top=50');
        unreadChats = chatsResp.value.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
      } catch {
        // Chat API might not be available
      }

      return {
        teams: teamsWithChannels,
        totalTeams: teams.length,
        unreadChats,
      };
    } catch (error) {
      // Teams API requires specific licenses
      return {
        teams: [],
        totalTeams: 0,
        unreadChats: 0,
        error: 'Teams data unavailable. May require Microsoft Teams license.',
      };
    }
  }

  private async getTasks(config: Microsoft365Config): Promise<IntegrationData> {
    try {
      const listsResp = await this.graphRequest<{
        value: Array<{
          id: string;
          displayName: string;
          isOwner: boolean;
          isShared: boolean;
        }>;
      }>(config, '/me/todo/lists');

      const lists = listsResp.value;

      // Get tasks for each list
      const listsWithTasks = await Promise.all(
        lists.map(async (list) => {
          try {
            const tasksResp = await this.graphRequest<{
              value: Array<{
                id: string;
                title: string;
                status: string;
                importance: string;
                dueDateTime?: { dateTime: string; timeZone: string };
                reminderDateTime?: { dateTime: string; timeZone: string };
                createdDateTime: string;
                completedDateTime?: { dateTime: string; timeZone: string };
              }>;
            }>(config, `/me/todo/lists/${list.id}/tasks?$top=50`);

            return {
              id: list.id,
              displayName: list.displayName,
              isOwner: list.isOwner,
              isShared: list.isShared,
              tasks: tasksResp.value.map((task) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                importance: task.importance,
                dueDateTime: task.dueDateTime?.dateTime,
                reminderDateTime: task.reminderDateTime?.dateTime,
                createdDateTime: task.createdDateTime,
                completedDateTime: task.completedDateTime?.dateTime,
              })),
            };
          } catch {
            return {
              id: list.id,
              displayName: list.displayName,
              isOwner: list.isOwner,
              isShared: list.isShared,
              tasks: [],
            };
          }
        })
      );

      // Calculate stats
      const allTasks = listsWithTasks.flatMap((l) => l.tasks);
      const completed = allTasks.filter((t) => t.status === 'completed');
      const pending = allTasks.filter((t) => t.status !== 'completed');
      const now = new Date();
      const overdue = pending.filter((t) => t.dueDateTime && new Date(t.dueDateTime) < now);
      const dueToday = pending.filter((t) => {
        if (!t.dueDateTime) return false;
        const due = new Date(t.dueDateTime);
        return (
          due.getFullYear() === now.getFullYear() &&
          due.getMonth() === now.getMonth() &&
          due.getDate() === now.getDate()
        );
      });

      return {
        todoLists: listsWithTasks,
        stats: {
          total: allTasks.length,
          completed: completed.length,
          pending: pending.length,
          overdue: overdue.length,
          dueToday: dueToday.length,
        },
      };
    } catch (error) {
      return {
        todoLists: [],
        stats: {
          total: 0,
          completed: 0,
          pending: 0,
          overdue: 0,
          dueToday: 0,
        },
        error: 'Tasks data unavailable.',
      };
    }
  }

  private async getProfile(config: Microsoft365Config): Promise<IntegrationData> {
    const [profileResp, presenceResp, managerResp] = await Promise.all([
      this.graphRequest<{
        id: string;
        displayName: string;
        mail: string;
        jobTitle?: string;
        department?: string;
        officeLocation?: string;
        mobilePhone?: string;
      }>(config, '/me'),
      this.graphRequest<{
        availability: string;
        activity: string;
      }>(config, '/me/presence').catch(() => ({
        availability: 'Unknown',
        activity: 'Unknown',
      })),
      this.graphRequest<{
        displayName: string;
        mail: string;
      }>(config, '/me/manager').catch(() => null),
    ]);

    // Try to get photo
    let photo: string | undefined;
    try {
      const photoResp = await axios.get(
        'https://graph.microsoft.com/v1.0/me/photo/$value',
        {
          headers: { Authorization: `Bearer ${await this.getAccessToken(config)}` },
          responseType: 'arraybuffer',
        }
      );
      photo = `data:image/jpeg;base64,${Buffer.from(photoResp.data).toString('base64')}`;
    } catch {
      // Photo not available
    }

    return {
      user: {
        id: profileResp.id,
        displayName: profileResp.displayName,
        mail: profileResp.mail,
        jobTitle: profileResp.jobTitle,
        department: profileResp.department,
        officeLocation: profileResp.officeLocation,
        mobilePhone: profileResp.mobilePhone,
        photo,
      },
      presence: {
        availability: presenceResp.availability,
        activity: presenceResp.activity,
      },
      manager: managerResp
        ? {
            displayName: managerResp.displayName,
            mail: managerResp.mail,
          }
        : undefined,
    };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'mail',
        name: 'Mail',
        description: 'Inbox status and recent messages',
        widgetTypes: ['microsoft365-mail'],
      },
      {
        id: 'calendar',
        name: 'Calendar',
        description: 'Today\'s events and upcoming meetings',
        widgetTypes: ['microsoft365-calendar'],
      },
      {
        id: 'onedrive',
        name: 'OneDrive',
        description: 'Storage usage and recent files',
        widgetTypes: ['microsoft365-onedrive'],
      },
      {
        id: 'teams',
        name: 'Teams',
        description: 'Teams and channels',
        widgetTypes: ['microsoft365-teams'],
      },
      {
        id: 'tasks',
        name: 'Tasks',
        description: 'To Do tasks and lists',
        widgetTypes: ['microsoft365-tasks'],
      },
      {
        id: 'profile',
        name: 'Profile',
        description: 'User profile and presence',
        widgetTypes: ['microsoft365-profile'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // User/Profile
      {
        id: 'get-me',
        name: 'Get Current User',
        description: 'Get the signed-in user profile',
        method: 'GET',
        endpoint: '/me',
        implemented: true,
        category: 'User',
        documentationUrl: 'https://learn.microsoft.com/en-us/graph/api/user-get',
      },
      {
        id: 'get-presence',
        name: 'Get Presence',
        description: 'Get user presence status',
        method: 'GET',
        endpoint: '/me/presence',
        implemented: true,
        category: 'User',
      },
      {
        id: 'get-manager',
        name: 'Get Manager',
        description: 'Get user\'s manager',
        method: 'GET',
        endpoint: '/me/manager',
        implemented: true,
        category: 'User',
      },
      {
        id: 'get-photo',
        name: 'Get Profile Photo',
        description: 'Get user profile photo',
        method: 'GET',
        endpoint: '/me/photo/$value',
        implemented: true,
        category: 'User',
      },

      // Mail
      {
        id: 'get-inbox',
        name: 'Get Inbox',
        description: 'Get inbox folder with unread count',
        method: 'GET',
        endpoint: '/me/mailFolders/Inbox',
        implemented: true,
        category: 'Mail',
      },
      {
        id: 'list-messages',
        name: 'List Messages',
        description: 'List messages in mailbox',
        method: 'GET',
        endpoint: '/me/messages',
        implemented: true,
        category: 'Mail',
        parameters: [
          { name: '$top', type: 'number', required: false, description: 'Number of messages to return' },
          { name: '$orderby', type: 'string', required: false, description: 'Sort order' },
          { name: '$filter', type: 'string', required: false, description: 'Filter criteria' },
        ],
      },
      {
        id: 'get-message',
        name: 'Get Message',
        description: 'Get a specific message',
        method: 'GET',
        endpoint: '/me/messages/{id}',
        implemented: false,
        category: 'Mail',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Message ID' },
        ],
      },
      {
        id: 'list-mail-folders',
        name: 'List Mail Folders',
        description: 'List all mail folders',
        method: 'GET',
        endpoint: '/me/mailFolders',
        implemented: false,
        category: 'Mail',
      },

      // Calendar
      {
        id: 'list-events',
        name: 'List Events',
        description: 'List calendar events',
        method: 'GET',
        endpoint: '/me/events',
        implemented: false,
        category: 'Calendar',
      },
      {
        id: 'get-calendar-view',
        name: 'Get Calendar View',
        description: 'Get events in a date range',
        method: 'GET',
        endpoint: '/me/calendarView',
        implemented: true,
        category: 'Calendar',
        parameters: [
          { name: 'startDateTime', type: 'string', required: true, description: 'Start date (ISO 8601)' },
          { name: 'endDateTime', type: 'string', required: true, description: 'End date (ISO 8601)' },
        ],
      },
      {
        id: 'list-calendars',
        name: 'List Calendars',
        description: 'List user calendars',
        method: 'GET',
        endpoint: '/me/calendars',
        implemented: false,
        category: 'Calendar',
      },

      // OneDrive
      {
        id: 'get-drive',
        name: 'Get Drive',
        description: 'Get user\'s OneDrive info and quota',
        method: 'GET',
        endpoint: '/me/drive',
        implemented: true,
        category: 'OneDrive',
      },
      {
        id: 'list-recent-files',
        name: 'List Recent Files',
        description: 'List recently accessed files',
        method: 'GET',
        endpoint: '/me/drive/recent',
        implemented: true,
        category: 'OneDrive',
      },
      {
        id: 'list-root-children',
        name: 'List Root Children',
        description: 'List items in root folder',
        method: 'GET',
        endpoint: '/me/drive/root/children',
        implemented: false,
        category: 'OneDrive',
      },
      {
        id: 'list-shared-with-me',
        name: 'List Shared With Me',
        description: 'List files shared with user',
        method: 'GET',
        endpoint: '/me/drive/sharedWithMe',
        implemented: false,
        category: 'OneDrive',
      },

      // Teams
      {
        id: 'list-joined-teams',
        name: 'List Joined Teams',
        description: 'List teams user is member of',
        method: 'GET',
        endpoint: '/me/joinedTeams',
        implemented: true,
        category: 'Teams',
      },
      {
        id: 'list-channels',
        name: 'List Channels',
        description: 'List channels in a team',
        method: 'GET',
        endpoint: '/teams/{team-id}/channels',
        implemented: true,
        category: 'Teams',
        parameters: [
          { name: 'team-id', type: 'string', required: true, description: 'Team ID' },
        ],
      },
      {
        id: 'list-chats',
        name: 'List Chats',
        description: 'List user chats',
        method: 'GET',
        endpoint: '/me/chats',
        implemented: true,
        category: 'Teams',
      },

      // Tasks (To Do)
      {
        id: 'list-todo-lists',
        name: 'List To Do Lists',
        description: 'List user\'s task lists',
        method: 'GET',
        endpoint: '/me/todo/lists',
        implemented: true,
        category: 'Tasks',
      },
      {
        id: 'list-tasks',
        name: 'List Tasks',
        description: 'List tasks in a list',
        method: 'GET',
        endpoint: '/me/todo/lists/{list-id}/tasks',
        implemented: true,
        category: 'Tasks',
        parameters: [
          { name: 'list-id', type: 'string', required: true, description: 'Task list ID' },
        ],
      },
      {
        id: 'create-task',
        name: 'Create Task',
        description: 'Create a new task',
        method: 'POST',
        endpoint: '/me/todo/lists/{list-id}/tasks',
        implemented: false,
        category: 'Tasks',
        parameters: [
          { name: 'list-id', type: 'string', required: true, description: 'Task list ID' },
          { name: 'title', type: 'string', required: true, description: 'Task title' },
          { name: 'dueDateTime', type: 'object', required: false, description: 'Due date' },
        ],
      },
    ];
  }
}
