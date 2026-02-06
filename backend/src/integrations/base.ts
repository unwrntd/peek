import { IntegrationConfig, IntegrationData } from '../types';

export interface MetricInfo {
  id: string;
  name: string;
  description: string;
  widgetTypes: string[];
}

export interface ApiCapability {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  implemented: boolean;
  category?: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  documentationUrl?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface CapabilityExecuteResult {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
}

export abstract class BaseIntegration {
  abstract readonly type: string;
  abstract readonly name: string;

  abstract testConnection(config: IntegrationConfig): Promise<ConnectionTestResult>;
  abstract getData(config: IntegrationConfig, metric: string): Promise<IntegrationData>;
  abstract getAvailableMetrics(): MetricInfo[];

  // Override in subclasses to expose full API capabilities
  getApiCapabilities(): ApiCapability[] {
    // Default: derive from metrics (for backwards compatibility)
    return this.getAvailableMetrics().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      method: 'GET' as const,
      endpoint: `/${m.id}`,
      implemented: true,
      category: 'Data',
    }));
  }

  // Generic capability execution - works for integrations with axios-based clients
  // Subclasses that have a createClient method will automatically support this
  async executeCapability(
    config: IntegrationConfig,
    capabilityId: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    parameters?: Record<string, unknown>
  ): Promise<CapabilityExecuteResult> {
    // Validate capability exists
    const capabilities = this.getApiCapabilities();
    const capability = capabilities.find((c) => c.id === capabilityId);
    if (!capability) {
      return { success: false, error: `Unknown capability: ${capabilityId}` };
    }

    // Try to get a client from the subclass if it has createClient method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    if (typeof self.createClient !== 'function') {
      return { success: false, error: 'This integration does not support capability execution' };
    }

    let client;
    try {
      // Handle both sync and async createClient methods
      const clientResult = self.createClient(config);
      client = clientResult instanceof Promise ? await clientResult : clientResult;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to create client: ${errMsg}` };
    }

    // Check if client is axios-like (has get, post, etc methods)
    // Axios instances are functions with methods attached, so check for the method directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientAny = client as any;
    if (!client || typeof clientAny.get !== 'function') {
      return { success: false, error: 'Integration client does not support HTTP requests' };
    }

    // Some integrations require additional authentication after client creation
    // (e.g., Proxmox needs to get a ticket/CSRF token)
    if (typeof self.authenticate === 'function') {
      try {
        await self.authenticate(client, config);
      } catch (authError) {
        const authErrorMsg = authError instanceof Error ? authError.message : String(authError);
        return { success: false, error: `Authentication failed: ${authErrorMsg}` };
      }
    }

    // Resolve endpoint placeholders like {id} with parameter values
    const resolvedEndpoint = endpoint.replace(/\{(\w+)\}/g, (_, key) =>
      String(parameters?.[key] ?? '')
    );

    // Separate path params from body/query params
    const pathParamMatches = endpoint.match(/\{(\w+)\}/g);
    const pathParams = new Set(pathParamMatches?.map((m) => m.slice(1, -1)) || []);
    const queryOrBodyParams = Object.fromEntries(
      Object.entries(parameters || {}).filter(([k]) => !pathParams.has(k))
    );

    // Some integrations (e.g., Kasm) require auth credentials in the request body
    // If getAuthBody exists, merge it with POST/PUT/PATCH request bodies
    let authBody: Record<string, unknown> = {};
    if (typeof self.getAuthBody === 'function') {
      authBody = self.getAuthBody(config);
    }

    const axiosClient = client as {
      get: (url: string, config?: Record<string, unknown>) => Promise<{ data: unknown; status: number }>;
      post: (url: string, data?: unknown) => Promise<{ data: unknown; status: number }>;
      put: (url: string, data?: unknown) => Promise<{ data: unknown; status: number }>;
      delete: (url: string, config?: Record<string, unknown>) => Promise<{ data: unknown; status: number }>;
      patch: (url: string, data?: unknown) => Promise<{ data: unknown; status: number }>;
    };

    try {
      let response;
      switch (method) {
        case 'GET':
          response = await axiosClient.get(resolvedEndpoint, {
            params: Object.keys(queryOrBodyParams).length > 0 ? queryOrBodyParams : undefined,
          });
          break;
        case 'POST':
          response = await axiosClient.post(resolvedEndpoint, { ...authBody, ...queryOrBodyParams });
          break;
        case 'PUT':
          response = await axiosClient.put(resolvedEndpoint, { ...authBody, ...queryOrBodyParams });
          break;
        case 'DELETE':
          response = await axiosClient.delete(resolvedEndpoint, {
            data: Object.keys(queryOrBodyParams).length > 0 ? queryOrBodyParams : undefined,
          });
          break;
        case 'PATCH':
          response = await axiosClient.patch(resolvedEndpoint, { ...authBody, ...queryOrBodyParams });
          break;
      }
      return { success: true, data: response.data, statusCode: response.status };
    } catch (error) {
      const axiosError = error as {
        message?: string;
        response?: { status?: number; data?: unknown };
      };
      return {
        success: false,
        error: axiosError.message || String(error),
        statusCode: axiosError.response?.status,
        data: axiosError.response?.data,
      };
    }
  }
}
