import axios from 'axios';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import { IntegrationData, GoogleWorkspaceConfig } from '../types';

// Token cache to avoid unnecessary refreshes
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export class GoogleWorkspaceIntegration extends BaseIntegration {
  readonly type = 'google-workspace';
  readonly name = 'Google Workspace';

  private async getAccessToken(config: GoogleWorkspaceConfig): Promise<string> {
    const cacheKey = `${config.clientId}`;
    const cached = tokenCache.get(cacheKey);

    // Return cached token if still valid (with 1 minute buffer)
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    // Refresh the token
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
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

  private async apiRequest<T>(
    config: GoogleWorkspaceConfig,
    url: string
  ): Promise<T> {
    const token = await this.getAccessToken(config);
    const response = await axios.get<T>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async testConnection(config: GoogleWorkspaceConfig): Promise<ConnectionTestResult> {
    try {
      const profile = await this.apiRequest<{
        emailAddress: string;
        messagesTotal: number;
      }>(config, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');

      return {
        success: true,
        message: `Connected as ${profile.emailAddress}`,
        details: { emailAddress: profile.emailAddress },
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

  async getData(config: GoogleWorkspaceConfig, metric: string): Promise<IntegrationData> {
    switch (metric) {
      case 'mail':
        return this.getMail(config);
      case 'calendar':
        return this.getCalendar(config);
      case 'drive':
        return this.getDrive(config);
      case 'tasks':
        return this.getTasks(config);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getMail(config: GoogleWorkspaceConfig): Promise<IntegrationData> {
    const [profileResp, inboxResp, messagesResp] = await Promise.all([
      this.apiRequest<{
        emailAddress: string;
        messagesTotal: number;
        threadsTotal: number;
      }>(config, 'https://gmail.googleapis.com/gmail/v1/users/me/profile'),
      this.apiRequest<{
        messagesTotal: number;
        messagesUnread: number;
      }>(config, 'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX'),
      this.apiRequest<{
        messages?: Array<{ id: string; threadId: string }>;
      }>(config, 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in:inbox'),
    ]);

    // Fetch message details for recent messages
    const recentMessages: Array<{
      id: string;
      threadId: string;
      subject: string;
      from: string;
      snippet: string;
      date: string;
      isUnread: boolean;
      hasAttachment: boolean;
    }> = [];

    if (messagesResp.messages) {
      const messageDetails = await Promise.all(
        messagesResp.messages.slice(0, 10).map((msg) =>
          this.apiRequest<{
            id: string;
            threadId: string;
            snippet: string;
            labelIds: string[];
            payload: {
              headers: Array<{ name: string; value: string }>;
              parts?: Array<{ filename?: string }>;
            };
            internalDate: string;
          }>(
            config,
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
          )
        )
      );

      for (const msg of messageDetails) {
        const headers = msg.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '(No subject)';
        const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
        const date = headers.find((h) => h.name === 'Date')?.value || '';

        recentMessages.push({
          id: msg.id,
          threadId: msg.threadId,
          subject,
          from,
          snippet: msg.snippet,
          date: msg.internalDate ? new Date(parseInt(msg.internalDate)).toISOString() : date,
          isUnread: msg.labelIds?.includes('UNREAD') || false,
          hasAttachment: msg.payload?.parts?.some((p) => p.filename && p.filename.length > 0) || false,
        });
      }
    }

    return {
      profile: {
        emailAddress: profileResp.emailAddress,
        messagesTotal: profileResp.messagesTotal,
        threadsTotal: profileResp.threadsTotal,
      },
      inbox: {
        total: inboxResp.messagesTotal,
        unread: inboxResp.messagesUnread,
      },
      recentMessages,
    };
  }

  private async getCalendar(config: GoogleWorkspaceConfig): Promise<IntegrationData> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [todayResp, weekResp, calendarsResp] = await Promise.all([
      this.apiRequest<{
        items?: Array<{
          id: string;
          summary?: string;
          description?: string;
          location?: string;
          start: { dateTime?: string; date?: string };
          end: { dateTime?: string; date?: string };
          status: string;
          htmlLink: string;
          hangoutLink?: string;
          creator?: { email: string; displayName?: string };
          organizer?: { email: string; displayName?: string };
          attendees?: Array<{
            email: string;
            displayName?: string;
            responseStatus: string;
          }>;
        }>;
      }>(
        config,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true&orderBy=startTime`
      ),
      this.apiRequest<{
        items?: Array<{
          id: string;
          summary?: string;
          description?: string;
          location?: string;
          start: { dateTime?: string; date?: string };
          end: { dateTime?: string; date?: string };
          status: string;
          htmlLink: string;
          hangoutLink?: string;
        }>;
      }>(
        config,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${endOfWeek.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=20`
      ),
      this.apiRequest<{
        items?: Array<{
          id: string;
          summary: string;
          primary?: boolean;
          backgroundColor?: string;
        }>;
      }>(config, 'https://www.googleapis.com/calendar/v3/users/me/calendarList'),
    ]);

    const mapEvent = (event: {
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      status: string;
      htmlLink: string;
      hangoutLink?: string;
      creator?: { email: string; displayName?: string };
      organizer?: { email: string; displayName?: string };
      attendees?: Array<{
        email: string;
        displayName?: string;
        responseStatus: string;
      }>;
    }) => ({
      id: event.id,
      summary: event.summary || '(No title)',
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      isAllDay: !event.start.dateTime,
      status: event.status,
      htmlLink: event.htmlLink,
      hangoutLink: event.hangoutLink,
      creator: event.creator,
      organizer: event.organizer,
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
      })),
    });

    const todayEvents = (todayResp.items || []).map(mapEvent);
    const upcomingEvents = (weekResp.items || []).map(mapEvent);

    // Find next event (first non-all-day event that hasn't ended)
    const nextEvent = upcomingEvents.find((e) => {
      if (e.isAllDay) return false;
      const endTime = e.end.dateTime ? new Date(e.end.dateTime) : null;
      return endTime && endTime > now;
    });

    return {
      calendars: (calendarsResp.items || []).map((c) => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary,
        backgroundColor: c.backgroundColor,
      })),
      todayEvents,
      upcomingEvents,
      stats: {
        todayCount: todayEvents.length,
        weekCount: upcomingEvents.length,
        nextEvent,
      },
    };
  }

  private async getDrive(config: GoogleWorkspaceConfig): Promise<IntegrationData> {
    const [aboutResp, filesResp] = await Promise.all([
      this.apiRequest<{
        user: {
          displayName: string;
          emailAddress: string;
          photoLink?: string;
        };
        storageQuota: {
          limit?: string;
          usage: string;
          usageInDrive: string;
          usageInDriveTrash: string;
        };
      }>(config, 'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota'),
      this.apiRequest<{
        files?: Array<{
          id: string;
          name: string;
          mimeType: string;
          size?: string;
          modifiedTime: string;
          viewedByMeTime?: string;
          webViewLink?: string;
          iconLink?: string;
          owners?: Array<{ displayName: string; emailAddress: string }>;
          shared: boolean;
        }>;
      }>(
        config,
        'https://www.googleapis.com/drive/v3/files?orderBy=viewedByMeTime desc&pageSize=10&fields=files(id,name,mimeType,size,modifiedTime,viewedByMeTime,webViewLink,iconLink,owners,shared)'
      ),
    ]);

    const limit = aboutResp.storageQuota.limit
      ? parseInt(aboutResp.storageQuota.limit)
      : 15 * 1024 * 1024 * 1024; // Default 15GB for personal accounts
    const usage = parseInt(aboutResp.storageQuota.usage);

    return {
      user: {
        displayName: aboutResp.user.displayName,
        emailAddress: aboutResp.user.emailAddress,
        photoLink: aboutResp.user.photoLink,
      },
      quota: {
        limit,
        usage,
        usageInDrive: parseInt(aboutResp.storageQuota.usageInDrive),
        usageInDriveTrash: parseInt(aboutResp.storageQuota.usageInDriveTrash),
        percentUsed: Math.round((usage / limit) * 100),
      },
      recentFiles: (filesResp.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? parseInt(f.size) : undefined,
        modifiedTime: f.modifiedTime,
        viewedByMeTime: f.viewedByMeTime,
        webViewLink: f.webViewLink,
        iconLink: f.iconLink,
        owners: f.owners,
        shared: f.shared,
      })),
    };
  }

  private async getTasks(config: GoogleWorkspaceConfig): Promise<IntegrationData> {
    const listsResp = await this.apiRequest<{
      items?: Array<{
        id: string;
        title: string;
      }>;
    }>(config, 'https://tasks.googleapis.com/tasks/v1/users/@me/lists');

    const taskLists = listsResp.items || [];

    // Get tasks for each list
    const listsWithTasks = await Promise.all(
      taskLists.map(async (list) => {
        try {
          const tasksResp = await this.apiRequest<{
            items?: Array<{
              id: string;
              title: string;
              notes?: string;
              status: string;
              due?: string;
              completed?: string;
              parent?: string;
              position: string;
            }>;
          }>(config, `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?maxResults=100`);

          return {
            id: list.id,
            title: list.title,
            tasks: (tasksResp.items || []).map((t) => ({
              id: t.id,
              title: t.title,
              notes: t.notes,
              status: t.status,
              due: t.due,
              completed: t.completed,
              parent: t.parent,
              position: t.position,
            })),
          };
        } catch {
          return {
            id: list.id,
            title: list.title,
            tasks: [],
          };
        }
      })
    );

    // Calculate stats
    const allTasks = listsWithTasks.flatMap((l) => l.tasks);
    const completed = allTasks.filter((t) => t.status === 'completed');
    const pending = allTasks.filter((t) => t.status === 'needsAction');
    const now = new Date();
    const overdue = pending.filter((t) => t.due && new Date(t.due) < now);

    return {
      taskLists: listsWithTasks,
      stats: {
        total: allTasks.length,
        completed: completed.length,
        pending: pending.length,
        overdue: overdue.length,
      },
    };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'mail',
        name: 'Gmail',
        description: 'Inbox status and recent messages',
        widgetTypes: ['google-mail'],
      },
      {
        id: 'calendar',
        name: 'Calendar',
        description: "Today's events and upcoming meetings",
        widgetTypes: ['google-calendar'],
      },
      {
        id: 'drive',
        name: 'Drive',
        description: 'Storage usage and recent files',
        widgetTypes: ['google-drive'],
      },
      {
        id: 'tasks',
        name: 'Tasks',
        description: 'Task lists and to-dos',
        widgetTypes: ['google-tasks'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Gmail
      {
        id: 'gmail-profile',
        name: 'Get Gmail Profile',
        description: 'Get user email and message counts',
        method: 'GET',
        endpoint: '/gmail/v1/users/me/profile',
        implemented: true,
        category: 'Gmail',
        documentationUrl: 'https://developers.google.com/gmail/api/reference/rest/v1/users/getProfile',
      },
      {
        id: 'gmail-labels',
        name: 'List Labels',
        description: 'Get all Gmail labels with counts',
        method: 'GET',
        endpoint: '/gmail/v1/users/me/labels',
        implemented: true,
        category: 'Gmail',
      },
      {
        id: 'gmail-inbox',
        name: 'Get Inbox Label',
        description: 'Get inbox with unread count',
        method: 'GET',
        endpoint: '/gmail/v1/users/me/labels/INBOX',
        implemented: true,
        category: 'Gmail',
      },
      {
        id: 'gmail-messages',
        name: 'List Messages',
        description: 'List messages with optional query',
        method: 'GET',
        endpoint: '/gmail/v1/users/me/messages',
        implemented: true,
        category: 'Gmail',
        parameters: [
          { name: 'q', type: 'string', required: false, description: 'Query filter (e.g., is:unread)' },
          { name: 'maxResults', type: 'number', required: false, description: 'Max messages to return' },
        ],
      },
      {
        id: 'gmail-message',
        name: 'Get Message',
        description: 'Get a specific message',
        method: 'GET',
        endpoint: '/gmail/v1/users/me/messages/{id}',
        implemented: true,
        category: 'Gmail',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Message ID' },
          { name: 'format', type: 'string', required: false, description: 'Format: full, metadata, minimal, raw' },
        ],
      },

      // Calendar
      {
        id: 'calendar-list',
        name: 'List Calendars',
        description: 'Get all calendars user has access to',
        method: 'GET',
        endpoint: '/calendar/v3/users/me/calendarList',
        implemented: true,
        category: 'Calendar',
      },
      {
        id: 'calendar-events',
        name: 'List Events',
        description: 'Get events from a calendar',
        method: 'GET',
        endpoint: '/calendar/v3/calendars/{calendarId}/events',
        implemented: true,
        category: 'Calendar',
        parameters: [
          { name: 'calendarId', type: 'string', required: true, description: 'Calendar ID (use "primary")' },
          { name: 'timeMin', type: 'string', required: false, description: 'Start time (ISO 8601)' },
          { name: 'timeMax', type: 'string', required: false, description: 'End time (ISO 8601)' },
          { name: 'maxResults', type: 'number', required: false, description: 'Max events' },
          { name: 'singleEvents', type: 'boolean', required: false, description: 'Expand recurring events' },
        ],
      },
      {
        id: 'calendar-primary',
        name: 'Get Primary Calendar',
        description: 'Get primary calendar info',
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary',
        implemented: false,
        category: 'Calendar',
      },

      // Drive
      {
        id: 'drive-about',
        name: 'Get Drive Info',
        description: 'Get user and storage quota info',
        method: 'GET',
        endpoint: '/drive/v3/about',
        implemented: true,
        category: 'Drive',
        parameters: [
          { name: 'fields', type: 'string', required: false, description: 'Fields to return' },
        ],
      },
      {
        id: 'drive-files',
        name: 'List Files',
        description: 'List files in Drive',
        method: 'GET',
        endpoint: '/drive/v3/files',
        implemented: true,
        category: 'Drive',
        parameters: [
          { name: 'orderBy', type: 'string', required: false, description: 'Sort order' },
          { name: 'pageSize', type: 'number', required: false, description: 'Max files to return' },
          { name: 'q', type: 'string', required: false, description: 'Query filter' },
        ],
      },
      {
        id: 'drive-file',
        name: 'Get File',
        description: 'Get file metadata',
        method: 'GET',
        endpoint: '/drive/v3/files/{fileId}',
        implemented: false,
        category: 'Drive',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
        ],
      },

      // Tasks
      {
        id: 'tasks-lists',
        name: 'List Task Lists',
        description: 'Get all task lists',
        method: 'GET',
        endpoint: '/tasks/v1/users/@me/lists',
        implemented: true,
        category: 'Tasks',
      },
      {
        id: 'tasks-tasks',
        name: 'List Tasks',
        description: 'Get tasks in a list',
        method: 'GET',
        endpoint: '/tasks/v1/lists/{tasklist}/tasks',
        implemented: true,
        category: 'Tasks',
        parameters: [
          { name: 'tasklist', type: 'string', required: true, description: 'Task list ID' },
          { name: 'showCompleted', type: 'boolean', required: false, description: 'Include completed tasks' },
          { name: 'maxResults', type: 'number', required: false, description: 'Max tasks to return' },
        ],
      },
    ];
  }
}
