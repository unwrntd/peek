import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationData } from '../types';
import { logger } from '../services/logger';

interface OllamaConfig {
  host: string;
  port: number;
  verifySSL?: boolean;
}

interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
}

interface OllamaRunningModel extends OllamaModel {
  expires_at: string;
  size_vram: number;
}

export class OllamaIntegration extends BaseIntegration {
  readonly type = 'ollama';
  readonly name = 'Ollama';

  private getBaseUrl(config: OllamaConfig): string {
    const protocol = config.verifySSL ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  private createClient(config: OllamaConfig): AxiosInstance {
    return axios.create({
      baseURL: this.getBaseUrl(config),
      headers: { 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: OllamaConfig): Promise<ConnectionTestResult> {
    try {
      logger.debug('ollama', 'Testing connection', { host: config.host, port: config.port });

      const client = this.createClient(config);
      const versionResponse = await client.get('/api/version');
      const modelsResponse = await client.get('/api/tags');

      const modelCount = modelsResponse.data.models?.length || 0;

      logger.info('ollama', 'Connection successful', {
        version: versionResponse.data.version,
        modelCount,
      });

      return {
        success: true,
        message: `Connected to Ollama v${versionResponse.data.version} (${modelCount} models)`,
        details: {
          version: versionResponse.data.version,
          modelCount,
        },
      };
    } catch (error) {
      logger.error('ollama', 'Connection test failed', { error });

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused. Is Ollama running on ${config.host}:${config.port}?`,
          };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          return {
            success: false,
            message: `Connection timed out. Check if ${config.host}:${config.port} is accessible.`,
          };
        }
        return {
          success: false,
          message: `Connection failed: ${error.message}`,
        };
      }

      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getData(config: OllamaConfig, metric: string): Promise<IntegrationData> {
    const client = this.createClient(config);

    switch (metric) {
      case 'models':
        return this.getModels(client);
      case 'running':
        return this.getRunningModels(client);
      case 'status':
        return this.getStatus(client);
      case 'storage':
        return this.getStorageStats(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getModels(client: AxiosInstance): Promise<{ models: OllamaModel[] }> {
    logger.debug('ollama', 'Fetching models');
    const response = await client.get('/api/tags');
    const models = response.data.models || [];
    logger.debug('ollama', 'Models fetched', { count: models.length });
    return { models };
  }

  private async getRunningModels(client: AxiosInstance): Promise<{ running: OllamaRunningModel[] }> {
    logger.debug('ollama', 'Fetching running models');
    const response = await client.get('/api/ps');
    const running = response.data.models || [];
    logger.debug('ollama', 'Running models fetched', { count: running.length });
    return { running };
  }

  private async getStatus(client: AxiosInstance): Promise<{
    status: { version: string; modelCount: number; runningCount: number };
  }> {
    logger.debug('ollama', 'Fetching status');

    const [versionRes, modelsRes, runningRes] = await Promise.all([
      client.get('/api/version'),
      client.get('/api/tags'),
      client.get('/api/ps'),
    ]);

    const status = {
      version: versionRes.data.version,
      modelCount: modelsRes.data.models?.length || 0,
      runningCount: runningRes.data.models?.length || 0,
    };

    logger.debug('ollama', 'Status fetched', status);

    return { status };
  }

  private async getStorageStats(client: AxiosInstance): Promise<{
    storage: { totalSize: number; modelCount: number; models: Array<{ name: string; size: number }> };
  }> {
    logger.debug('ollama', 'Fetching storage stats');
    const response = await client.get('/api/tags');
    const models: OllamaModel[] = response.data.models || [];

    const totalSize = models.reduce((sum, m) => sum + (m.size || 0), 0);

    const storage = {
      totalSize,
      modelCount: models.length,
      models: models.map((m) => ({ name: m.name, size: m.size })),
    };

    logger.debug('ollama', 'Storage stats fetched', { totalSize, modelCount: models.length });

    return { storage };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Ollama server status and version',
        widgetTypes: ['ollama-status'],
      },
      {
        id: 'models',
        name: 'Model List',
        description: 'All locally available models',
        widgetTypes: ['ollama-models'],
      },
      {
        id: 'running',
        name: 'Running Models',
        description: 'Currently loaded models with VRAM usage',
        widgetTypes: ['ollama-running'],
      },
      {
        id: 'storage',
        name: 'Storage Usage',
        description: 'Total storage used by models',
        widgetTypes: ['ollama-storage'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Models - Implemented
      {
        id: 'list-models',
        name: 'List Local Models',
        description: 'List all models that are available locally',
        method: 'GET',
        endpoint: '/api/tags',
        implemented: true,
        category: 'Models',
        documentationUrl: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
      },
      {
        id: 'list-running',
        name: 'List Running Models',
        description: 'List models that are currently loaded in memory',
        method: 'GET',
        endpoint: '/api/ps',
        implemented: true,
        category: 'Models',
      },
      {
        id: 'show-model',
        name: 'Show Model Information',
        description: 'Show detailed information about a model including modelfile, template, parameters, license, and system prompt',
        method: 'POST',
        endpoint: '/api/show',
        implemented: false,
        category: 'Models',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Name of the model to show' },
          { name: 'verbose', type: 'boolean', required: false, description: 'Return full data for verbose response fields' },
        ],
      },
      {
        id: 'pull-model',
        name: 'Pull a Model',
        description: 'Download a model from the Ollama library',
        method: 'POST',
        endpoint: '/api/pull',
        implemented: false,
        category: 'Models',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Name of the model to pull' },
          { name: 'insecure', type: 'boolean', required: false, description: 'Allow insecure connections' },
          { name: 'stream', type: 'boolean', required: false, description: 'Stream the response' },
        ],
      },
      {
        id: 'push-model',
        name: 'Push a Model',
        description: 'Upload a model to a model library (requires ollama.ai registration)',
        method: 'POST',
        endpoint: '/api/push',
        implemented: false,
        category: 'Models',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Model name in format namespace/model:tag' },
          { name: 'insecure', type: 'boolean', required: false, description: 'Allow insecure connections' },
          { name: 'stream', type: 'boolean', required: false, description: 'Stream the response' },
        ],
      },
      {
        id: 'copy-model',
        name: 'Copy a Model',
        description: 'Create a copy of a model with a new name',
        method: 'POST',
        endpoint: '/api/copy',
        implemented: false,
        category: 'Models',
        parameters: [
          { name: 'source', type: 'string', required: true, description: 'Name of the source model' },
          { name: 'destination', type: 'string', required: true, description: 'Name for the new model' },
        ],
      },
      {
        id: 'delete-model',
        name: 'Delete a Model',
        description: 'Delete a model and its data',
        method: 'DELETE',
        endpoint: '/api/delete',
        implemented: false,
        category: 'Models',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Name of the model to delete' },
        ],
      },
      {
        id: 'create-model',
        name: 'Create a Model',
        description: 'Create a model from a Modelfile or by specifying parameters',
        method: 'POST',
        endpoint: '/api/create',
        implemented: false,
        category: 'Models',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Name of the model to create' },
          { name: 'modelfile', type: 'string', required: false, description: 'Contents of the Modelfile' },
          { name: 'from', type: 'string', required: false, description: 'Base model to create from' },
          { name: 'stream', type: 'boolean', required: false, description: 'Stream the response' },
          { name: 'quantize', type: 'string', required: false, description: 'Quantize the model (e.g., q4_0)' },
        ],
      },

      // Generation
      {
        id: 'generate',
        name: 'Generate a Completion',
        description: 'Generate a response for a given prompt with a specified model',
        method: 'POST',
        endpoint: '/api/generate',
        implemented: false,
        category: 'Generation',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Model name to use for generation' },
          { name: 'prompt', type: 'string', required: true, description: 'The prompt to generate a response for' },
          { name: 'images', type: 'array', required: false, description: 'Base64-encoded images for multimodal models' },
          { name: 'format', type: 'string', required: false, description: 'Response format (e.g., json)' },
          { name: 'options', type: 'object', required: false, description: 'Model parameters like temperature, top_p, etc.' },
          { name: 'system', type: 'string', required: false, description: 'System prompt to use' },
          { name: 'template', type: 'string', required: false, description: 'Prompt template to use' },
          { name: 'context', type: 'array', required: false, description: 'Context from previous request for conversation' },
          { name: 'stream', type: 'boolean', required: false, description: 'Stream the response (default: true)' },
          { name: 'raw', type: 'boolean', required: false, description: 'Bypass prompt templating' },
          { name: 'keep_alive', type: 'string', required: false, description: 'How long to keep model loaded (e.g., 5m)' },
        ],
      },
      {
        id: 'chat',
        name: 'Generate a Chat Completion',
        description: 'Generate the next message in a chat conversation with a specified model',
        method: 'POST',
        endpoint: '/api/chat',
        implemented: false,
        category: 'Generation',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Model name to use for chat' },
          { name: 'messages', type: 'array', required: true, description: 'Array of message objects with role and content' },
          { name: 'format', type: 'string', required: false, description: 'Response format (e.g., json)' },
          { name: 'options', type: 'object', required: false, description: 'Model parameters like temperature, top_p, etc.' },
          { name: 'stream', type: 'boolean', required: false, description: 'Stream the response (default: true)' },
          { name: 'keep_alive', type: 'string', required: false, description: 'How long to keep model loaded' },
          { name: 'tools', type: 'array', required: false, description: 'List of tools the model may call' },
        ],
      },

      // Embeddings
      {
        id: 'embeddings',
        name: 'Generate Embeddings',
        description: 'Generate embeddings from a model for the given input',
        method: 'POST',
        endpoint: '/api/embeddings',
        implemented: false,
        category: 'Embeddings',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Name of model to generate embeddings from' },
          { name: 'prompt', type: 'string', required: true, description: 'Text to generate embeddings for' },
          { name: 'options', type: 'object', required: false, description: 'Model parameters' },
          { name: 'keep_alive', type: 'string', required: false, description: 'How long to keep model loaded' },
        ],
      },
      {
        id: 'embed',
        name: 'Generate Embeddings (Batch)',
        description: 'Generate embeddings for one or more inputs',
        method: 'POST',
        endpoint: '/api/embed',
        implemented: false,
        category: 'Embeddings',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Name of model to generate embeddings from' },
          { name: 'input', type: 'string | array', required: true, description: 'Text or array of texts to embed' },
          { name: 'truncate', type: 'boolean', required: false, description: 'Truncate input to fit context length' },
          { name: 'options', type: 'object', required: false, description: 'Model parameters' },
          { name: 'keep_alive', type: 'string', required: false, description: 'How long to keep model loaded' },
        ],
      },

      // Blobs
      {
        id: 'check-blob',
        name: 'Check Blob Exists',
        description: 'Check if a blob exists on the server',
        method: 'GET',
        endpoint: '/api/blobs/:digest',
        implemented: false,
        category: 'Blobs',
        parameters: [
          { name: 'digest', type: 'string', required: true, description: 'SHA256 digest of the blob' },
        ],
      },
      {
        id: 'create-blob',
        name: 'Create a Blob',
        description: 'Create a blob from a file on the server',
        method: 'POST',
        endpoint: '/api/blobs/:digest',
        implemented: false,
        category: 'Blobs',
        parameters: [
          { name: 'digest', type: 'string', required: true, description: 'Expected SHA256 digest of the file' },
        ],
      },

      // System - Implemented
      {
        id: 'version',
        name: 'Get Version',
        description: 'Get the Ollama server version',
        method: 'GET',
        endpoint: '/api/version',
        implemented: true,
        category: 'System',
      },
      {
        id: 'health',
        name: 'Health Check',
        description: 'Check if the Ollama server is running',
        method: 'GET',
        endpoint: '/',
        implemented: false,
        category: 'System',
      },

      // OpenAI Compatibility
      {
        id: 'openai-chat-completions',
        name: 'OpenAI Chat Completions',
        description: 'OpenAI-compatible chat completions endpoint',
        method: 'POST',
        endpoint: '/v1/chat/completions',
        implemented: false,
        category: 'OpenAI Compatibility',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Model to use' },
          { name: 'messages', type: 'array', required: true, description: 'Chat messages' },
          { name: 'temperature', type: 'number', required: false, description: 'Sampling temperature' },
          { name: 'max_tokens', type: 'number', required: false, description: 'Maximum tokens to generate' },
          { name: 'stream', type: 'boolean', required: false, description: 'Stream the response' },
        ],
      },
      {
        id: 'openai-completions',
        name: 'OpenAI Completions',
        description: 'OpenAI-compatible completions endpoint',
        method: 'POST',
        endpoint: '/v1/completions',
        implemented: false,
        category: 'OpenAI Compatibility',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Model to use' },
          { name: 'prompt', type: 'string', required: true, description: 'Prompt to complete' },
          { name: 'temperature', type: 'number', required: false, description: 'Sampling temperature' },
          { name: 'max_tokens', type: 'number', required: false, description: 'Maximum tokens to generate' },
        ],
      },
      {
        id: 'openai-models',
        name: 'OpenAI List Models',
        description: 'OpenAI-compatible list models endpoint',
        method: 'GET',
        endpoint: '/v1/models',
        implemented: false,
        category: 'OpenAI Compatibility',
      },
      {
        id: 'openai-model',
        name: 'OpenAI Get Model',
        description: 'OpenAI-compatible get model endpoint',
        method: 'GET',
        endpoint: '/v1/models/:model',
        implemented: false,
        category: 'OpenAI Compatibility',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Model name to retrieve' },
        ],
      },
      {
        id: 'openai-embeddings',
        name: 'OpenAI Embeddings',
        description: 'OpenAI-compatible embeddings endpoint',
        method: 'POST',
        endpoint: '/v1/embeddings',
        implemented: false,
        category: 'OpenAI Compatibility',
        parameters: [
          { name: 'model', type: 'string', required: true, description: 'Model to use' },
          { name: 'input', type: 'string | array', required: true, description: 'Text to embed' },
        ],
      },
    ];
  }
}
