import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationConfig, IntegrationData } from '../types';
import { logger } from '../services/logger';

interface PaperlessConfig {
  host: string;
  port: number;
  apiToken?: string;
  username?: string;
  password?: string;
  verifySSL?: boolean;
  basePath?: string;
}

interface TokenCache {
  token: string;
  expiry: number;
}

const tokenCache = new Map<string, TokenCache>();

export class PaperlessIntegration extends BaseIntegration {
  readonly type = 'paperless';
  readonly name = 'Paperless-ngx';

  private getConfigKey(config: PaperlessConfig): string {
    return `paperless_${config.host}_${config.port}`;
  }

  private getBaseUrl(config: PaperlessConfig): string {
    const protocol = config.verifySSL ? 'https' : 'http';
    const basePath = config.basePath || '';
    return `${protocol}://${config.host}:${config.port}${basePath}`;
  }

  private async getAuthToken(config: PaperlessConfig): Promise<string> {
    // If API token is provided directly, use it
    if (config.apiToken) {
      return config.apiToken;
    }

    // Otherwise, get token via username/password
    const cacheKey = this.getConfigKey(config);
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.token;
    }

    if (!config.username || !config.password) {
      throw new Error('API token or username/password required');
    }

    try {
      const response = await axios.post(
        `${this.getBaseUrl(config)}/api/token/`,
        {
          username: config.username,
          password: config.password,
        },
        {
          httpsAgent: new https.Agent({
            rejectUnauthorized: config.verifySSL ?? false,
          }),
          timeout: 15000,
        }
      );

      const token = response.data.token;
      tokenCache.set(cacheKey, {
        token,
        expiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('paperless', 'Failed to get auth token', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  private async createClient(config: PaperlessConfig): Promise<AxiosInstance> {
    const token = await this.getAuthToken(config);

    return axios.create({
      baseURL: `${this.getBaseUrl(config)}/api`,
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json; version=9',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const plConfig = config as unknown as PaperlessConfig;

    if (!plConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!plConfig.port) {
      return { success: false, message: 'Port is required' };
    }
    if (!plConfig.apiToken && (!plConfig.username || !plConfig.password)) {
      return { success: false, message: 'API token or username/password required' };
    }

    try {
      const client = await this.createClient(plConfig);

      const [statsRes, tagsRes] = await Promise.all([
        client.get('/statistics/'),
        client.get('/tags/', { params: { page_size: 1 } }),
      ]);

      const docCount = statsRes.data.documents_total || 0;
      const tagCount = tagsRes.data.count || 0;

      return {
        success: true,
        message: `Connected to Paperless-ngx (${docCount} documents, ${tagCount} tags)`,
        details: { documentCount: docCount, tagCount },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('paperless', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('401') || errorMsg.includes('403')) {
        return { success: false, message: 'Invalid credentials or token' };
      }
      if (errorMsg.includes('ECONNREFUSED')) {
        return { success: false, message: `Connection refused at ${plConfig.host}:${plConfig.port}` };
      }
      if (errorMsg.includes('ENOTFOUND')) {
        return { success: false, message: `Host not found: ${plConfig.host}` };
      }
      if (errorMsg.includes('certificate')) {
        return { success: false, message: 'SSL certificate error. Try disabling SSL verification.' };
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const plConfig = config as unknown as PaperlessConfig;
    const client = await this.createClient(plConfig);

    switch (metric) {
      case 'statistics':
        return this.getStatistics(client);
      case 'documents':
        return this.getDocuments(client);
      case 'inbox':
        return this.getInbox(client);
      case 'tags':
        return this.getTags(client);
      case 'correspondents':
        return this.getCorrespondents(client);
      case 'document-types':
        return this.getDocumentTypes(client);
      case 'tasks':
        return this.getTasks(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatistics(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/statistics/');
      const stats = response.data;

      return {
        statistics: {
          totalDocuments: stats.documents_total || 0,
          inboxCount: stats.documents_inbox || 0,
          characterCount: stats.character_count || 0,
          fileTypes: stats.document_file_type_counts || [],
        },
      };
    } catch (error) {
      logger.error('paperless', 'Failed to get statistics', { error });
      throw error;
    }
  }

  private async getDocuments(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/documents/', {
        params: {
          page_size: 50,
          ordering: '-added',
        },
      });

      const documents = response.data.results || [];

      // Get correspondents and document types for display names
      const [correspondentsRes, docTypesRes, tagsRes] = await Promise.all([
        client.get('/correspondents/', { params: { page_size: 100 } }),
        client.get('/document_types/', { params: { page_size: 100 } }),
        client.get('/tags/', { params: { page_size: 100 } }),
      ]);

      const correspondentMap = new Map(
        (correspondentsRes.data.results || []).map((c: { id: number; name: string }) => [c.id, c.name])
      );
      const docTypeMap = new Map(
        (docTypesRes.data.results || []).map((d: { id: number; name: string }) => [d.id, d.name])
      );
      const tagMap = new Map(
        (tagsRes.data.results || []).map((t: { id: number; name: string; color: string }) => [t.id, { name: t.name, color: t.color }])
      );

      // Enrich documents with names
      const enrichedDocuments = documents.map((doc: Record<string, unknown>) => ({
        ...doc,
        correspondentName: doc.correspondent ? correspondentMap.get(doc.correspondent as number) : null,
        documentTypeName: doc.document_type ? docTypeMap.get(doc.document_type as number) : null,
        tagDetails: (doc.tags as number[] || []).map((tagId: number) => tagMap.get(tagId)).filter(Boolean),
      }));

      return {
        documents: enrichedDocuments,
        total: response.data.count || 0,
      };
    } catch (error) {
      logger.error('paperless', 'Failed to get documents', { error });
      throw error;
    }
  }

  private async getInbox(client: AxiosInstance): Promise<IntegrationData> {
    try {
      // First get the inbox tag
      const statsRes = await client.get('/statistics/');
      const inboxTagId = statsRes.data.inbox_tag;

      if (!inboxTagId) {
        return { inbox: [], count: 0 };
      }

      const response = await client.get('/documents/', {
        params: {
          tags__id: inboxTagId,
          page_size: 50,
          ordering: '-added',
        },
      });

      return {
        inbox: response.data.results || [],
        count: response.data.count || 0,
      };
    } catch (error) {
      logger.error('paperless', 'Failed to get inbox', { error });
      throw error;
    }
  }

  private async getTags(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/tags/', {
        params: { page_size: 100 },
      });

      return {
        tags: response.data.results || [],
        total: response.data.count || 0,
      };
    } catch (error) {
      logger.error('paperless', 'Failed to get tags', { error });
      throw error;
    }
  }

  private async getCorrespondents(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/correspondents/', {
        params: { page_size: 100 },
      });

      return {
        correspondents: response.data.results || [],
        total: response.data.count || 0,
      };
    } catch (error) {
      logger.error('paperless', 'Failed to get correspondents', { error });
      throw error;
    }
  }

  private async getDocumentTypes(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/document_types/', {
        params: { page_size: 100 },
      });

      return {
        documentTypes: response.data.results || [],
        total: response.data.count || 0,
      };
    } catch (error) {
      logger.error('paperless', 'Failed to get document types', { error });
      throw error;
    }
  }

  private async getTasks(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/tasks/', {
        params: { page_size: 50 },
      });

      const tasks = response.data.results || [];
      const pending = tasks.filter((t: { status: string }) =>
        ['PENDING', 'STARTED'].includes(t.status)
      ).length;
      const failed = tasks.filter((t: { status: string }) => t.status === 'FAILURE').length;
      const success = tasks.filter((t: { status: string }) => t.status === 'SUCCESS').length;

      return {
        tasks: tasks,
        total: response.data.count || 0,
        pending,
        failed,
        success,
      };
    } catch (error) {
      logger.error('paperless', 'Failed to get tasks', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'statistics',
        name: 'Statistics',
        description: 'Document statistics',
        widgetTypes: ['paperless-stats'],
      },
      {
        id: 'documents',
        name: 'Documents',
        description: 'Recent documents',
        widgetTypes: ['paperless-recent'],
      },
      {
        id: 'inbox',
        name: 'Inbox',
        description: 'Inbox documents',
        widgetTypes: ['paperless-inbox'],
      },
      {
        id: 'tags',
        name: 'Tags',
        description: 'Document tags',
        widgetTypes: ['paperless-tags'],
      },
      {
        id: 'correspondents',
        name: 'Correspondents',
        description: 'Document correspondents',
        widgetTypes: ['paperless-correspondents'],
      },
      {
        id: 'document-types',
        name: 'Document Types',
        description: 'Document type distribution',
        widgetTypes: ['paperless-document-types'],
      },
      {
        id: 'tasks',
        name: 'Tasks',
        description: 'Background tasks',
        widgetTypes: ['paperless-tasks'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'token',
        name: 'Get Auth Token',
        description: 'Acquire authentication token by posting username and password',
        method: 'POST',
        endpoint: '/token/',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
        ],
        documentationUrl: 'https://docs.paperless-ngx.com/api/#authentication',
      },

      // Statistics - Implemented
      {
        id: 'statistics',
        name: 'Get Statistics',
        description: 'Get document statistics including total count, inbox count, character count, and file type distribution',
        method: 'GET',
        endpoint: '/statistics/',
        implemented: true,
        category: 'Statistics',
        documentationUrl: 'https://docs.paperless-ngx.com/api/',
      },

      // Documents - Implemented
      {
        id: 'documents-list',
        name: 'List Documents',
        description: 'Get a list of all documents with filtering and pagination',
        method: 'GET',
        endpoint: '/documents/',
        implemented: true,
        category: 'Documents',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'page_size', type: 'number', required: false, description: 'Items per page' },
          { name: 'ordering', type: 'string', required: false, description: 'Sort field (prefix with - for descending)' },
          { name: 'query', type: 'string', required: false, description: 'Full text search query' },
          { name: 'more_like_id', type: 'number', required: false, description: 'Find similar documents by ID' },
          { name: 'tags__id', type: 'number', required: false, description: 'Filter by tag ID' },
          { name: 'correspondent__id', type: 'number', required: false, description: 'Filter by correspondent ID' },
          { name: 'document_type__id', type: 'number', required: false, description: 'Filter by document type ID' },
        ],
        documentationUrl: 'https://docs.paperless-ngx.com/api/',
      },
      {
        id: 'documents-get',
        name: 'Get Document',
        description: 'Get a single document by ID',
        method: 'GET',
        endpoint: '/documents/{id}/',
        implemented: false,
        category: 'Documents',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Document ID' },
        ],
      },
      {
        id: 'documents-create',
        name: 'Upload Document',
        description: 'Upload and consume a new document',
        method: 'POST',
        endpoint: '/documents/post_document/',
        implemented: false,
        category: 'Documents',
        parameters: [
          { name: 'document', type: 'file', required: true, description: 'Document file' },
          { name: 'title', type: 'string', required: false, description: 'Document title' },
          { name: 'created', type: 'string', required: false, description: 'Creation date (YYYY-MM-DD)' },
          { name: 'correspondent', type: 'number', required: false, description: 'Correspondent ID' },
          { name: 'document_type', type: 'number', required: false, description: 'Document type ID' },
          { name: 'tags', type: 'array', required: false, description: 'Array of tag IDs' },
          { name: 'archive_serial_number', type: 'number', required: false, description: 'Archive serial number' },
          { name: 'custom_fields', type: 'object', required: false, description: 'Custom field values' },
        ],
        documentationUrl: 'https://docs.paperless-ngx.com/api/',
      },
      {
        id: 'documents-update',
        name: 'Update Document',
        description: 'Update document metadata',
        method: 'PATCH',
        endpoint: '/documents/{id}/',
        implemented: false,
        category: 'Documents',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Document ID' },
          { name: 'title', type: 'string', required: false, description: 'Document title' },
          { name: 'correspondent', type: 'number', required: false, description: 'Correspondent ID' },
          { name: 'document_type', type: 'number', required: false, description: 'Document type ID' },
          { name: 'tags', type: 'array', required: false, description: 'Array of tag IDs' },
        ],
      },
      {
        id: 'documents-delete',
        name: 'Delete Document',
        description: 'Delete a document',
        method: 'DELETE',
        endpoint: '/documents/{id}/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-download',
        name: 'Download Document',
        description: 'Download the original document file',
        method: 'GET',
        endpoint: '/documents/{id}/download/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-preview',
        name: 'Preview Document',
        description: 'Display the document inline without downloading',
        method: 'GET',
        endpoint: '/documents/{id}/preview/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-thumb',
        name: 'Get Document Thumbnail',
        description: 'Download the PNG thumbnail of a document',
        method: 'GET',
        endpoint: '/documents/{id}/thumb/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-metadata',
        name: 'Get Document Metadata',
        description: 'Get metadata of a document including archive checksum and original filename',
        method: 'GET',
        endpoint: '/documents/{id}/metadata/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-suggestions',
        name: 'Get Document Suggestions',
        description: 'Get suggested tags, correspondents, and document types for a document',
        method: 'GET',
        endpoint: '/documents/{id}/suggestions/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-bulk-edit',
        name: 'Bulk Edit Documents',
        description: 'Perform bulk operations on multiple documents (set correspondent, add tags, delete, merge, etc.)',
        method: 'POST',
        endpoint: '/documents/bulk_edit/',
        implemented: false,
        category: 'Documents',
        parameters: [
          { name: 'documents', type: 'array', required: true, description: 'Array of document IDs' },
          { name: 'method', type: 'string', required: true, description: 'Operation: set_correspondent, set_document_type, add_tag, remove_tag, delete, reprocess, merge, split, rotate, etc.' },
        ],
        documentationUrl: 'https://docs.paperless-ngx.com/api/',
      },
      {
        id: 'documents-bulk-download',
        name: 'Bulk Download Documents',
        description: 'Download multiple documents as a zip archive',
        method: 'POST',
        endpoint: '/documents/bulk_download/',
        implemented: false,
        category: 'Documents',
        parameters: [
          { name: 'documents', type: 'array', required: true, description: 'Array of document IDs' },
          { name: 'content', type: 'string', required: false, description: 'Content type: originals, archive, or both' },
        ],
      },
      {
        id: 'documents-notes',
        name: 'Get Document Notes',
        description: 'Get notes associated with a document',
        method: 'GET',
        endpoint: '/documents/{id}/notes/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-notes-create',
        name: 'Add Document Note',
        description: 'Add a note to a document',
        method: 'POST',
        endpoint: '/documents/{id}/notes/',
        implemented: false,
        category: 'Documents',
        parameters: [
          { name: 'note', type: 'string', required: true, description: 'Note content' },
        ],
      },
      {
        id: 'documents-share-links',
        name: 'Get Share Links',
        description: 'Get share links for a document',
        method: 'GET',
        endpoint: '/share_links/',
        implemented: false,
        category: 'Documents',
      },
      {
        id: 'documents-share-links-create',
        name: 'Create Share Link',
        description: 'Create a public share link for a document',
        method: 'POST',
        endpoint: '/share_links/',
        implemented: false,
        category: 'Documents',
        parameters: [
          { name: 'document', type: 'number', required: true, description: 'Document ID' },
          { name: 'expiration', type: 'string', required: false, description: 'Expiration date' },
        ],
      },

      // Tags - Implemented
      {
        id: 'tags-list',
        name: 'List Tags',
        description: 'Get a list of all tags',
        method: 'GET',
        endpoint: '/tags/',
        implemented: true,
        category: 'Tags',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'page_size', type: 'number', required: false, description: 'Items per page' },
        ],
      },
      {
        id: 'tags-get',
        name: 'Get Tag',
        description: 'Get a single tag by ID',
        method: 'GET',
        endpoint: '/tags/{id}/',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-create',
        name: 'Create Tag',
        description: 'Create a new tag',
        method: 'POST',
        endpoint: '/tags/',
        implemented: false,
        category: 'Tags',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Tag name' },
          { name: 'color', type: 'string', required: false, description: 'Tag color (hex)' },
          { name: 'is_inbox_tag', type: 'boolean', required: false, description: 'Mark as inbox tag' },
          { name: 'matching_algorithm', type: 'number', required: false, description: 'Auto-matching algorithm' },
          { name: 'match', type: 'string', required: false, description: 'Match pattern' },
        ],
      },
      {
        id: 'tags-update',
        name: 'Update Tag',
        description: 'Update a tag',
        method: 'PATCH',
        endpoint: '/tags/{id}/',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-delete',
        name: 'Delete Tag',
        description: 'Delete a tag',
        method: 'DELETE',
        endpoint: '/tags/{id}/',
        implemented: false,
        category: 'Tags',
      },

      // Correspondents - Implemented
      {
        id: 'correspondents-list',
        name: 'List Correspondents',
        description: 'Get a list of all correspondents',
        method: 'GET',
        endpoint: '/correspondents/',
        implemented: true,
        category: 'Correspondents',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'page_size', type: 'number', required: false, description: 'Items per page' },
        ],
      },
      {
        id: 'correspondents-get',
        name: 'Get Correspondent',
        description: 'Get a single correspondent by ID',
        method: 'GET',
        endpoint: '/correspondents/{id}/',
        implemented: false,
        category: 'Correspondents',
      },
      {
        id: 'correspondents-create',
        name: 'Create Correspondent',
        description: 'Create a new correspondent',
        method: 'POST',
        endpoint: '/correspondents/',
        implemented: false,
        category: 'Correspondents',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Correspondent name' },
          { name: 'matching_algorithm', type: 'number', required: false, description: 'Auto-matching algorithm' },
          { name: 'match', type: 'string', required: false, description: 'Match pattern' },
        ],
      },
      {
        id: 'correspondents-update',
        name: 'Update Correspondent',
        description: 'Update a correspondent',
        method: 'PATCH',
        endpoint: '/correspondents/{id}/',
        implemented: false,
        category: 'Correspondents',
      },
      {
        id: 'correspondents-delete',
        name: 'Delete Correspondent',
        description: 'Delete a correspondent',
        method: 'DELETE',
        endpoint: '/correspondents/{id}/',
        implemented: false,
        category: 'Correspondents',
      },

      // Document Types - Implemented
      {
        id: 'document-types-list',
        name: 'List Document Types',
        description: 'Get a list of all document types',
        method: 'GET',
        endpoint: '/document_types/',
        implemented: true,
        category: 'Document Types',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'page_size', type: 'number', required: false, description: 'Items per page' },
        ],
      },
      {
        id: 'document-types-get',
        name: 'Get Document Type',
        description: 'Get a single document type by ID',
        method: 'GET',
        endpoint: '/document_types/{id}/',
        implemented: false,
        category: 'Document Types',
      },
      {
        id: 'document-types-create',
        name: 'Create Document Type',
        description: 'Create a new document type',
        method: 'POST',
        endpoint: '/document_types/',
        implemented: false,
        category: 'Document Types',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Document type name' },
          { name: 'matching_algorithm', type: 'number', required: false, description: 'Auto-matching algorithm' },
          { name: 'match', type: 'string', required: false, description: 'Match pattern' },
        ],
      },
      {
        id: 'document-types-update',
        name: 'Update Document Type',
        description: 'Update a document type',
        method: 'PATCH',
        endpoint: '/document_types/{id}/',
        implemented: false,
        category: 'Document Types',
      },
      {
        id: 'document-types-delete',
        name: 'Delete Document Type',
        description: 'Delete a document type',
        method: 'DELETE',
        endpoint: '/document_types/{id}/',
        implemented: false,
        category: 'Document Types',
      },

      // Storage Paths
      {
        id: 'storage-paths-list',
        name: 'List Storage Paths',
        description: 'Get a list of all storage paths',
        method: 'GET',
        endpoint: '/storage_paths/',
        implemented: false,
        category: 'Storage Paths',
      },
      {
        id: 'storage-paths-get',
        name: 'Get Storage Path',
        description: 'Get a single storage path by ID',
        method: 'GET',
        endpoint: '/storage_paths/{id}/',
        implemented: false,
        category: 'Storage Paths',
      },
      {
        id: 'storage-paths-create',
        name: 'Create Storage Path',
        description: 'Create a new storage path',
        method: 'POST',
        endpoint: '/storage_paths/',
        implemented: false,
        category: 'Storage Paths',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Storage path name' },
          { name: 'path', type: 'string', required: true, description: 'Path template' },
        ],
      },
      {
        id: 'storage-paths-update',
        name: 'Update Storage Path',
        description: 'Update a storage path',
        method: 'PATCH',
        endpoint: '/storage_paths/{id}/',
        implemented: false,
        category: 'Storage Paths',
      },
      {
        id: 'storage-paths-delete',
        name: 'Delete Storage Path',
        description: 'Delete a storage path',
        method: 'DELETE',
        endpoint: '/storage_paths/{id}/',
        implemented: false,
        category: 'Storage Paths',
      },

      // Saved Views
      {
        id: 'saved-views-list',
        name: 'List Saved Views',
        description: 'Get a list of all saved views',
        method: 'GET',
        endpoint: '/saved_views/',
        implemented: false,
        category: 'Saved Views',
      },
      {
        id: 'saved-views-get',
        name: 'Get Saved View',
        description: 'Get a single saved view by ID',
        method: 'GET',
        endpoint: '/saved_views/{id}/',
        implemented: false,
        category: 'Saved Views',
      },
      {
        id: 'saved-views-create',
        name: 'Create Saved View',
        description: 'Create a new saved view',
        method: 'POST',
        endpoint: '/saved_views/',
        implemented: false,
        category: 'Saved Views',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'View name' },
          { name: 'show_on_dashboard', type: 'boolean', required: false, description: 'Show on dashboard' },
          { name: 'show_in_sidebar', type: 'boolean', required: false, description: 'Show in sidebar' },
          { name: 'filter_rules', type: 'array', required: false, description: 'Filter rules' },
        ],
      },
      {
        id: 'saved-views-update',
        name: 'Update Saved View',
        description: 'Update a saved view',
        method: 'PATCH',
        endpoint: '/saved_views/{id}/',
        implemented: false,
        category: 'Saved Views',
      },
      {
        id: 'saved-views-delete',
        name: 'Delete Saved View',
        description: 'Delete a saved view',
        method: 'DELETE',
        endpoint: '/saved_views/{id}/',
        implemented: false,
        category: 'Saved Views',
      },

      // Custom Fields
      {
        id: 'custom-fields-list',
        name: 'List Custom Fields',
        description: 'Get a list of all custom fields',
        method: 'GET',
        endpoint: '/custom_fields/',
        implemented: false,
        category: 'Custom Fields',
      },
      {
        id: 'custom-fields-get',
        name: 'Get Custom Field',
        description: 'Get a single custom field by ID',
        method: 'GET',
        endpoint: '/custom_fields/{id}/',
        implemented: false,
        category: 'Custom Fields',
      },
      {
        id: 'custom-fields-create',
        name: 'Create Custom Field',
        description: 'Create a new custom field',
        method: 'POST',
        endpoint: '/custom_fields/',
        implemented: false,
        category: 'Custom Fields',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Field name' },
          { name: 'data_type', type: 'string', required: true, description: 'Data type: string, url, date, boolean, integer, float, monetary, documentlink, select' },
        ],
      },
      {
        id: 'custom-fields-update',
        name: 'Update Custom Field',
        description: 'Update a custom field',
        method: 'PATCH',
        endpoint: '/custom_fields/{id}/',
        implemented: false,
        category: 'Custom Fields',
      },
      {
        id: 'custom-fields-delete',
        name: 'Delete Custom Field',
        description: 'Delete a custom field',
        method: 'DELETE',
        endpoint: '/custom_fields/{id}/',
        implemented: false,
        category: 'Custom Fields',
      },

      // Tasks - Implemented
      {
        id: 'tasks-list',
        name: 'List Tasks',
        description: 'Get a list of background tasks and their status',
        method: 'GET',
        endpoint: '/tasks/',
        implemented: true,
        category: 'Tasks',
        parameters: [
          { name: 'page_size', type: 'number', required: false, description: 'Items per page' },
          { name: 'task_id', type: 'string', required: false, description: 'Filter by task UUID' },
        ],
      },
      {
        id: 'tasks-acknowledge',
        name: 'Acknowledge Tasks',
        description: 'Acknowledge completed tasks',
        method: 'POST',
        endpoint: '/tasks/acknowledge/',
        implemented: false,
        category: 'Tasks',
        parameters: [
          { name: 'tasks', type: 'array', required: true, description: 'Array of task IDs to acknowledge' },
        ],
      },

      // Workflows
      {
        id: 'workflows-list',
        name: 'List Workflows',
        description: 'Get a list of all workflows (formerly consumption templates)',
        method: 'GET',
        endpoint: '/workflows/',
        implemented: false,
        category: 'Workflows',
      },
      {
        id: 'workflows-get',
        name: 'Get Workflow',
        description: 'Get a single workflow by ID',
        method: 'GET',
        endpoint: '/workflows/{id}/',
        implemented: false,
        category: 'Workflows',
      },
      {
        id: 'workflows-create',
        name: 'Create Workflow',
        description: 'Create a new workflow',
        method: 'POST',
        endpoint: '/workflows/',
        implemented: false,
        category: 'Workflows',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Workflow name' },
          { name: 'triggers', type: 'array', required: true, description: 'Workflow triggers' },
          { name: 'actions', type: 'array', required: true, description: 'Workflow actions' },
        ],
      },
      {
        id: 'workflows-update',
        name: 'Update Workflow',
        description: 'Update a workflow',
        method: 'PATCH',
        endpoint: '/workflows/{id}/',
        implemented: false,
        category: 'Workflows',
      },
      {
        id: 'workflows-delete',
        name: 'Delete Workflow',
        description: 'Delete a workflow',
        method: 'DELETE',
        endpoint: '/workflows/{id}/',
        implemented: false,
        category: 'Workflows',
      },

      // Mail Accounts
      {
        id: 'mail-accounts-list',
        name: 'List Mail Accounts',
        description: 'Get a list of all mail accounts for email import',
        method: 'GET',
        endpoint: '/mail_accounts/',
        implemented: false,
        category: 'Mail',
      },
      {
        id: 'mail-accounts-get',
        name: 'Get Mail Account',
        description: 'Get a single mail account by ID',
        method: 'GET',
        endpoint: '/mail_accounts/{id}/',
        implemented: false,
        category: 'Mail',
      },
      {
        id: 'mail-accounts-create',
        name: 'Create Mail Account',
        description: 'Create a new mail account',
        method: 'POST',
        endpoint: '/mail_accounts/',
        implemented: false,
        category: 'Mail',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Account name' },
          { name: 'imap_server', type: 'string', required: true, description: 'IMAP server address' },
          { name: 'imap_port', type: 'number', required: false, description: 'IMAP port' },
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
        ],
      },
      {
        id: 'mail-accounts-update',
        name: 'Update Mail Account',
        description: 'Update a mail account',
        method: 'PATCH',
        endpoint: '/mail_accounts/{id}/',
        implemented: false,
        category: 'Mail',
      },
      {
        id: 'mail-accounts-delete',
        name: 'Delete Mail Account',
        description: 'Delete a mail account',
        method: 'DELETE',
        endpoint: '/mail_accounts/{id}/',
        implemented: false,
        category: 'Mail',
      },
      {
        id: 'mail-accounts-test',
        name: 'Test Mail Account',
        description: 'Test connection to a mail account',
        method: 'POST',
        endpoint: '/mail_accounts/{id}/test/',
        implemented: false,
        category: 'Mail',
      },

      // Mail Rules
      {
        id: 'mail-rules-list',
        name: 'List Mail Rules',
        description: 'Get a list of all mail rules',
        method: 'GET',
        endpoint: '/mail_rules/',
        implemented: false,
        category: 'Mail',
      },
      {
        id: 'mail-rules-get',
        name: 'Get Mail Rule',
        description: 'Get a single mail rule by ID',
        method: 'GET',
        endpoint: '/mail_rules/{id}/',
        implemented: false,
        category: 'Mail',
      },
      {
        id: 'mail-rules-create',
        name: 'Create Mail Rule',
        description: 'Create a new mail rule',
        method: 'POST',
        endpoint: '/mail_rules/',
        implemented: false,
        category: 'Mail',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Rule name' },
          { name: 'account', type: 'number', required: true, description: 'Mail account ID' },
          { name: 'folder', type: 'string', required: false, description: 'Mail folder to monitor' },
          { name: 'action', type: 'number', required: true, description: 'Action to perform' },
        ],
      },
      {
        id: 'mail-rules-update',
        name: 'Update Mail Rule',
        description: 'Update a mail rule',
        method: 'PATCH',
        endpoint: '/mail_rules/{id}/',
        implemented: false,
        category: 'Mail',
      },
      {
        id: 'mail-rules-delete',
        name: 'Delete Mail Rule',
        description: 'Delete a mail rule',
        method: 'DELETE',
        endpoint: '/mail_rules/{id}/',
        implemented: false,
        category: 'Mail',
      },

      // Users
      {
        id: 'users-list',
        name: 'List Users',
        description: 'Get a list of all users',
        method: 'GET',
        endpoint: '/users/',
        implemented: false,
        category: 'Users & Groups',
      },
      {
        id: 'users-get',
        name: 'Get User',
        description: 'Get a single user by ID',
        method: 'GET',
        endpoint: '/users/{id}/',
        implemented: false,
        category: 'Users & Groups',
      },
      {
        id: 'users-create',
        name: 'Create User',
        description: 'Create a new user',
        method: 'POST',
        endpoint: '/users/',
        implemented: false,
        category: 'Users & Groups',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
          { name: 'email', type: 'string', required: false, description: 'Email address' },
          { name: 'is_superuser', type: 'boolean', required: false, description: 'Admin privileges' },
        ],
      },
      {
        id: 'users-update',
        name: 'Update User',
        description: 'Update a user',
        method: 'PATCH',
        endpoint: '/users/{id}/',
        implemented: false,
        category: 'Users & Groups',
      },
      {
        id: 'users-delete',
        name: 'Delete User',
        description: 'Delete a user',
        method: 'DELETE',
        endpoint: '/users/{id}/',
        implemented: false,
        category: 'Users & Groups',
      },

      // Groups
      {
        id: 'groups-list',
        name: 'List Groups',
        description: 'Get a list of all groups',
        method: 'GET',
        endpoint: '/groups/',
        implemented: false,
        category: 'Users & Groups',
      },
      {
        id: 'groups-get',
        name: 'Get Group',
        description: 'Get a single group by ID',
        method: 'GET',
        endpoint: '/groups/{id}/',
        implemented: false,
        category: 'Users & Groups',
      },
      {
        id: 'groups-create',
        name: 'Create Group',
        description: 'Create a new group',
        method: 'POST',
        endpoint: '/groups/',
        implemented: false,
        category: 'Users & Groups',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Group name' },
          { name: 'permissions', type: 'array', required: false, description: 'Permission IDs' },
        ],
      },
      {
        id: 'groups-update',
        name: 'Update Group',
        description: 'Update a group',
        method: 'PATCH',
        endpoint: '/groups/{id}/',
        implemented: false,
        category: 'Users & Groups',
      },
      {
        id: 'groups-delete',
        name: 'Delete Group',
        description: 'Delete a group',
        method: 'DELETE',
        endpoint: '/groups/{id}/',
        implemented: false,
        category: 'Users & Groups',
      },

      // Logs
      {
        id: 'logs-list',
        name: 'List Logs',
        description: 'Get application logs',
        method: 'GET',
        endpoint: '/logs/',
        implemented: false,
        category: 'System',
      },

      // UI Settings
      {
        id: 'ui-settings',
        name: 'Get UI Settings',
        description: 'Get user interface settings',
        method: 'GET',
        endpoint: '/ui_settings/',
        implemented: false,
        category: 'System',
      },
      {
        id: 'ui-settings-update',
        name: 'Update UI Settings',
        description: 'Update user interface settings',
        method: 'POST',
        endpoint: '/ui_settings/',
        implemented: false,
        category: 'System',
      },

      // Search
      {
        id: 'search',
        name: 'Global Search',
        description: 'Search across all objects (documents, tags, correspondents, etc.)',
        method: 'GET',
        endpoint: '/search/',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query (min 3 characters)' },
        ],
      },
      {
        id: 'search-autocomplete',
        name: 'Search Autocomplete',
        description: 'Get auto-complete suggestions for partial search terms',
        method: 'GET',
        endpoint: '/search/autocomplete/',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'term', type: 'string', required: true, description: 'Incomplete search term' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum results (default 10)' },
        ],
      },

      // Bulk Operations
      {
        id: 'bulk-edit-objects',
        name: 'Bulk Edit Objects',
        description: 'Bulk edit tags, correspondents, document types, or storage paths',
        method: 'POST',
        endpoint: '/bulk_edit_objects/',
        implemented: false,
        category: 'Bulk Operations',
        parameters: [
          { name: 'objects', type: 'array', required: true, description: 'Array of object IDs' },
          { name: 'object_type', type: 'string', required: true, description: 'Object type: tags, correspondents, document_types, storage_paths' },
          { name: 'operation', type: 'string', required: true, description: 'Operation: set_permissions or delete' },
        ],
      },

      // Permissions
      {
        id: 'permissions-list',
        name: 'List Permissions',
        description: 'Get available permissions',
        method: 'GET',
        endpoint: '/permissions/',
        implemented: false,
        category: 'Permissions',
      },

      // Trash
      {
        id: 'trash-list',
        name: 'List Trashed Documents',
        description: 'Get a list of trashed documents',
        method: 'GET',
        endpoint: '/trash/',
        implemented: false,
        category: 'Trash',
      },
      {
        id: 'trash-restore',
        name: 'Restore from Trash',
        description: 'Restore a document from trash',
        method: 'POST',
        endpoint: '/trash/{id}/restore/',
        implemented: false,
        category: 'Trash',
      },
      {
        id: 'trash-empty',
        name: 'Empty Trash',
        description: 'Permanently delete all trashed documents',
        method: 'POST',
        endpoint: '/trash/empty/',
        implemented: false,
        category: 'Trash',
      },

      // Remote Version
      {
        id: 'remote-version',
        name: 'Get Remote Version',
        description: 'Check for available updates',
        method: 'GET',
        endpoint: '/remote_version/',
        implemented: false,
        category: 'System',
      },
    ];
  }
}
