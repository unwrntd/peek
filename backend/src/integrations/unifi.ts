import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationConfig, IntegrationData, UnifiConfig, UnifiClient, UnifiDevice, UnifiHealth, UnifiSwitchPort } from '../types';
import { logger } from '../services/logger';

// Types for additional widgets (username/password auth only)
interface WlanInfo {
  _id: string;
  name: string;
  enabled: boolean;
  security: string;
  is_guest: boolean;
  num_sta: number;
}

interface DpiCategory {
  cat: number;
  app: number;
  rx_bytes: number;
  tx_bytes: number;
  rx_packets: number;
  tx_packets: number;
}

interface NetworkEvent {
  _id: string;
  key: string;
  msg: string;
  time: number;
  datetime: string;
  subsystem: string;
}

interface SpeedTestResult {
  xput_download: number;
  xput_upload: number;
  latency: number;
  rundate: number;
  status_download: number;
  status_upload: number;
  status_ping: number;
}

interface WanInfo {
  wan_ip: string | null;
  wan2_ip: string | null;
  wan1_status: string;
  wan2_status: string;
  gw_name: string | null;
  gw_mac: string | null;
  gw_version: string | null;
  wan1_isp_name: string | null;
  wan1_isp_organization: string | null;
  wan2_isp_name: string | null;
  wan2_isp_organization: string | null;
  wan1_netmask: string | null;
  wan2_netmask: string | null;
  wan1_uptime: number | null;
  wan2_uptime: number | null;
  wan1_tx_bytes: number;
  wan1_rx_bytes: number;
  wan2_tx_bytes: number;
  wan2_rx_bytes: number;
}

// Session cache to avoid rate limiting from repeated logins
interface CachedSession {
  cookies: string[];
  csrfToken?: string;
  isUnifiOS: boolean;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();

// Pending login promises to prevent concurrent login attempts (race condition fix)
// When multiple requests come in simultaneously, only the first one should login
// and others should wait for that login to complete
const pendingLogins = new Map<string, Promise<CachedSession>>();

// Failed login cache to prevent hammering a rate-limited server
interface FailedLogin {
  error: Error;
  expiresAt: number;
  retryCount: number;
}
const failedLogins = new Map<string, FailedLogin>();
// UniFi rate limits typically last 10-15 minutes, use longer initial backoff
// to avoid resetting UniFi's rate limit timer with repeated failed attempts
const FAILED_LOGIN_BASE_TTL = 10 * 60 * 1000; // Start with 10 minutes
const FAILED_LOGIN_MAX_TTL = 30 * 60 * 1000; // Max 30 minutes

// Site resolution cache to avoid repeated site lookups
interface CachedSiteId {
  siteId: string;
  expiresAt: number;
}

const siteCache = new Map<string, CachedSiteId>();
const SITE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Endpoint response cache - shares API responses across metrics that use the same endpoint
// This dramatically reduces API calls when multiple widgets request related data
interface CachedEndpointResponse {
  data: unknown;
  expiresAt: number;
}

const endpointCache = new Map<string, CachedEndpointResponse>();
const ENDPOINT_CACHE_TTL = 45 * 1000; // 45 seconds - balance between freshness and rate limiting

// Pending endpoint requests - prevents duplicate concurrent requests to the same endpoint
const pendingEndpointRequests = new Map<string, Promise<unknown>>();

/**
 * Get cached endpoint response or fetch fresh data
 * This is the core rate limiting protection - multiple metrics calling the same
 * endpoint within the TTL window will share a single API response
 */
async function getCachedEndpoint<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number = ENDPOINT_CACHE_TTL
): Promise<T> {
  // Check cache first
  const cached = endpointCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug('unifi', 'Endpoint cache hit', { cacheKey, expiresIn: Math.round((cached.expiresAt - Date.now()) / 1000) + 's' });
    return cached.data as T;
  }

  // Check if there's already a pending request for this endpoint
  const pendingRequest = pendingEndpointRequests.get(cacheKey);
  if (pendingRequest) {
    logger.debug('unifi', 'Waiting for pending endpoint request', { cacheKey });
    return pendingRequest as Promise<T>;
  }

  // Create new request
  const requestPromise = (async () => {
    try {
      const data = await fetchFn();
      // Cache the response
      endpointCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
      logger.debug('unifi', 'Endpoint response cached', { cacheKey, ttl: ttl / 1000 + 's' });
      return data;
    } finally {
      // Always clean up pending request
      pendingEndpointRequests.delete(cacheKey);
    }
  })();

  pendingEndpointRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// Export function to clear caches (for manual retry after rate limit)
export function clearUnifiCaches(host?: string): { cleared: number; message: string } {
  let cleared = 0;

  if (host) {
    // Clear caches for specific host
    for (const key of sessionCache.keys()) {
      if (key.includes(host)) {
        sessionCache.delete(key);
        cleared++;
      }
    }
    for (const key of failedLogins.keys()) {
      if (key.includes(host)) {
        failedLogins.delete(key);
        cleared++;
      }
    }
    for (const key of siteCache.keys()) {
      if (key.includes(host)) {
        siteCache.delete(key);
        cleared++;
      }
    }
    for (const key of endpointCache.keys()) {
      if (key.includes(host)) {
        endpointCache.delete(key);
        cleared++;
      }
    }
    logger.info('unifi', `Cleared caches for host: ${host}`, { cleared });
    return { cleared, message: `Cleared ${cleared} cache entries for ${host}` };
  } else {
    // Clear all caches
    const sessionCount = sessionCache.size;
    const failedCount = failedLogins.size;
    const siteCount = siteCache.size;
    const endpointCount = endpointCache.size;

    sessionCache.clear();
    failedLogins.clear();
    siteCache.clear();
    endpointCache.clear();

    cleared = sessionCount + failedCount + siteCount + endpointCount;
    logger.info('unifi', 'Cleared all UniFi caches', { sessionCount, failedCount, siteCount, endpointCount });
    return { cleared, message: `Cleared all UniFi caches: ${sessionCount} sessions, ${failedCount} failed logins, ${siteCount} sites, ${endpointCount} endpoints` };
  }
}

export class UnifiIntegration extends BaseIntegration {
  readonly type = 'unifi';
  readonly name = 'UniFi Controller';

  private getSessionCacheKey(config: UnifiConfig): string {
    return `${config.host}:${config.port || 443}:${config.username}`;
  }

  private getCachedSession(config: UnifiConfig): CachedSession | null {
    const key = this.getSessionCacheKey(config);
    const session = sessionCache.get(key);

    if (session && session.expiresAt > Date.now()) {
      logger.debug('unifi', 'Using cached session', { key, expiresIn: Math.round((session.expiresAt - Date.now()) / 1000) + 's' });
      return session;
    }

    if (session) {
      logger.debug('unifi', 'Cached session expired, removing', { key });
      sessionCache.delete(key);
    }

    return null;
  }

  private cacheSession(config: UnifiConfig, session: Omit<CachedSession, 'expiresAt'>): void {
    const key = this.getSessionCacheKey(config);
    // Cache for 25 minutes (UniFi sessions typically last 30 minutes)
    const expiresAt = Date.now() + 25 * 60 * 1000;
    sessionCache.set(key, { ...session, expiresAt });
    logger.debug('unifi', 'Cached session', { key, expiresIn: '25m' });
  }

  private clearSessionCache(config: UnifiConfig): void {
    const key = this.getSessionCacheKey(config);
    sessionCache.delete(key);
    failedLogins.delete(key); // Also clear failed login cache to allow fresh login attempts
    logger.debug('unifi', 'Cleared session cache', { key });
  }

  private createClient(config: UnifiConfig): AxiosInstance {
    const baseURL = `https://${config.host}:${config.port || 443}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // If using API key, set the header
    if (config.apiKey) {
      headers['X-API-KEY'] = config.apiKey;
    }

    const client = axios.create({
      baseURL,
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
      withCredentials: true,
    });

    // Add response interceptor for debugging and session invalidation
    client.interceptors.response.use(
      (response) => {
        logger.debug('unifi', 'Response received', {
          url: response.config.url,
          status: response.status,
          hasSetCookie: !!response.headers['set-cookie'],
        });
        return response;
      },
      (error) => {
        logger.debug('unifi', 'Request error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          requestHeaders: error.config?.headers ? Object.keys(error.config.headers) : [],
          hasCookieHeader: !!error.config?.headers?.Cookie,
          cookieValue: error.config?.headers?.Cookie?.substring(0, 50),
        });

        // If we get a 401 on a non-login endpoint, clear the session cache
        // so the next request will re-authenticate
        if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
          logger.debug('unifi', 'Got 401 on authenticated request, clearing session cache');
          this.clearSessionCache(config);
        }

        return Promise.reject(error);
      }
    );

    return client;
  }

  private async detectUnifiOS(client: AxiosInstance): Promise<{ isUnifiOS: boolean; csrfToken?: string }> {
    // Auto-detect if we're talking to a UDM Pro/UniFi OS device or standard controller
    // by checking for specific headers in the response
    try {
      logger.debug('unifi', 'Detecting UniFi device type...');
      const response = await client.get('/', { validateStatus: () => true });
      const headers = response.headers;

      // Check for CSRF token (UniFi OS < 3.2.5)
      const csrfToken = headers['x-csrf-token'] as string | undefined;
      if (csrfToken) {
        logger.debug('unifi', 'Detected UniFi OS (< 3.2.5) with CSRF token');
        return { isUnifiOS: true, csrfToken };
      }

      // Check for access-control-expose-headers (UniFi OS >= 3.2.5 or Network API)
      if (headers['access-control-expose-headers'] || headers['Access-Control-Expose-Headers']) {
        logger.debug('unifi', 'Detected UniFi OS (>= 3.2.5) or Network API');
        return { isUnifiOS: true };
      }

      logger.debug('unifi', 'Detected standard UniFi controller');
      return { isUnifiOS: false };
    } catch (error) {
      logger.debug('unifi', 'Device detection failed, assuming standard controller', { error: String(error) });
      return { isUnifiOS: false };
    }
  }

  private async loginWithCredentials(client: AxiosInstance, config: UnifiConfig): Promise<{ cookies: string[]; isUnifiOS: boolean; csrfToken?: string }> {
    // First, detect the device type
    const { isUnifiOS, csrfToken: initialCsrfToken } = await this.detectUnifiOS(client);
    let csrfToken = initialCsrfToken;

    // Login payload - use remember: true and rememberMe: true like gethomepage does
    const loginPayload = {
      username: config.username,
      password: config.password,
      remember: true,
      rememberMe: true,
    };

    const loginHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add CSRF token if detected (required for UniFi OS < 3.2.5)
    if (csrfToken) {
      loginHeaders['X-CSRF-TOKEN'] = csrfToken;
      logger.debug('unifi', 'Using CSRF token for login');
    }

    // Determine login endpoint based on device type
    const loginEndpoint = isUnifiOS ? '/api/auth/login' : '/api/login';

    try {
      logger.debug('unifi', `Attempting login to ${loginEndpoint}`, {
        isUnifiOS,
        hasCsrfToken: !!csrfToken,
        payload: { ...loginPayload, password: '***' },
      });

      const response = await client.post(loginEndpoint, loginPayload, {
        headers: loginHeaders,
      });

      // Log ALL response headers for debugging
      logger.debug('unifi', 'Login response headers', {
        allHeaders: Object.keys(response.headers),
        setCookie: response.headers['set-cookie'],
        contentType: response.headers['content-type'],
        csrfToken: response.headers['x-csrf-token'],
      });

      const cookies = response.headers['set-cookie'] || [];
      const data = response.data;

      // Check if login response provides a new CSRF token
      // Prefer x-updated-csrf-token over x-csrf-token (gethomepage uses this)
      const updatedCsrfToken = response.headers['x-updated-csrf-token'] as string | undefined;
      const responseCsrfToken = response.headers['x-csrf-token'] as string | undefined;
      if (updatedCsrfToken) {
        csrfToken = updatedCsrfToken;
        logger.debug('unifi', 'Using x-updated-csrf-token from login response', { token: updatedCsrfToken });
      } else if (responseCsrfToken) {
        csrfToken = responseCsrfToken;
        logger.debug('unifi', 'Using x-csrf-token from login response', { token: responseCsrfToken });
      }

      // Verify login success - gethomepage checks for meta.rc === 'ok' OR login_time OR update_time
      const isSuccess = data?.meta?.rc === 'ok' || data?.login_time || data?.update_time || response.status === 200;

      if (!isSuccess) {
        logger.error('unifi', 'Login response indicates failure', { data });
        throw new Error('Login failed: Invalid credentials or account type');
      }

      logger.debug('unifi', 'Login successful', {
        cookieCount: cookies.length,
        isUnifiOS,
        hasLoginTime: !!data?.login_time,
        hasMetaRc: !!data?.meta?.rc,
        hasCsrfToken: !!csrfToken,
      });

      return { cookies, isUnifiOS, csrfToken };
    } catch (e: unknown) {
      const axiosError = e as { response?: { status?: number; data?: unknown; headers?: Record<string, string> }; message?: string };

      // If we got a 401, check if there's a CSRF token we missed
      if (axiosError.response?.status === 401) {
        const newCsrfToken = axiosError.response.headers?.['x-csrf-token'];
        if (newCsrfToken && newCsrfToken !== initialCsrfToken) {
          logger.debug('unifi', 'Got new CSRF token from 401 response, retrying...');
          csrfToken = newCsrfToken;
          loginHeaders['X-CSRF-TOKEN'] = newCsrfToken;

          try {
            const retryResponse = await client.post(loginEndpoint, loginPayload, {
              headers: loginHeaders,
            });
            const cookies = retryResponse.headers['set-cookie'] || [];
            const responseCsrfToken = retryResponse.headers['x-csrf-token'] as string | undefined;
            if (responseCsrfToken) {
              csrfToken = responseCsrfToken;
            }
            logger.debug('unifi', 'Login successful after CSRF token retry', { cookieCount: cookies.length, hasCsrfToken: !!csrfToken });
            return { cookies, isUnifiOS, csrfToken };
          } catch (retryError) {
            logger.debug('unifi', 'CSRF retry also failed', { error: String(retryError) });
          }
        }
      }

      logger.error('unifi', 'Login failed', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });

      // Provide helpful error message based on error type
      if (axiosError.response?.status === 429) {
        throw new Error(
          'UniFi rate limit reached: Too many login attempts. Please wait 10-15 minutes for the rate limit to reset, ' +
          'then reload the page or use the "Clear Cache" button in the integration settings.'
        );
      }

      throw new Error(
        'UniFi login failed: Check that you are using a local controller user (not Ubiquiti SSO/cloud account). ' +
        'Create a local admin user in UniFi Settings > Admins > Add Admin with "Local Access Only".'
      );
    }
  }

  private setAuthCookies(client: AxiosInstance, cookies: string[], csrfToken?: string): void {
    if (!cookies || cookies.length === 0) {
      logger.warn('unifi', 'No cookies to set!');
      return;
    }

    const cookieString = cookies
      .map(cookie => cookie.split(';')[0])
      .join('; ');

    logger.debug('unifi', 'Setting auth cookies on client', {
      cookieString,
      rawCookies: cookies,
      cookieCount: cookies.length,
      hasCsrfToken: !!csrfToken,
    });

    // Use an interceptor to ensure cookies and CSRF token are sent with every request
    client.interceptors.request.use((config) => {
      config.headers['Cookie'] = cookieString;
      if (csrfToken) {
        config.headers['X-CSRF-TOKEN'] = csrfToken;
      }
      logger.debug('unifi', 'Request interceptor adding auth headers', {
        url: config.url,
        method: config.method,
        hasCookie: !!config.headers['Cookie'],
        hasCsrfToken: !!config.headers['X-CSRF-TOKEN'],
      });
      return config;
    });

    // Also set on defaults as backup
    client.defaults.headers.common['Cookie'] = cookieString;
    if (csrfToken) {
      client.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
    }
  }

  private isApiKeyAuth(config: UnifiConfig): boolean {
    return !!config.apiKey;
  }

  // Get authenticated session (from cache or fresh login)
  // Uses a pending login mechanism to prevent concurrent login attempts (race condition fix)
  private async getAuthenticatedSession(
    client: AxiosInstance,
    config: UnifiConfig
  ): Promise<{ isUnifiOS: boolean }> {
    const cacheKey = this.getSessionCacheKey(config);

    // Check cache first
    const cachedSession = this.getCachedSession(config);
    if (cachedSession) {
      this.setAuthCookies(client, cachedSession.cookies, cachedSession.csrfToken);
      return { isUnifiOS: cachedSession.isUnifiOS };
    }

    // Check if we recently failed to login (rate limit protection)
    const failedLogin = failedLogins.get(cacheKey);
    if (failedLogin && failedLogin.expiresAt > Date.now()) {
      const waitSeconds = Math.ceil((failedLogin.expiresAt - Date.now()) / 1000);
      const waitDisplay = waitSeconds >= 60
        ? `${Math.ceil(waitSeconds / 60)}m ${waitSeconds % 60}s`
        : `${waitSeconds}s`;
      logger.debug('unifi', 'Recent login failed, refusing to retry', {
        key: cacheKey,
        waitTime: waitDisplay,
        attempt: failedLogin.retryCount
      });
      throw failedLogin.error;
    }

    // Check if there's already a login in progress for this config
    // If so, wait for it instead of starting a new login
    const existingLoginPromise = pendingLogins.get(cacheKey);
    if (existingLoginPromise) {
      logger.debug('unifi', 'Waiting for existing login to complete', { key: cacheKey });
      // Wait for the existing login - don't retry on failure, just propagate the error
      const session = await existingLoginPromise;
      this.setAuthCookies(client, session.cookies, session.csrfToken);
      return { isUnifiOS: session.isUnifiOS };
    }

    // Create a new login promise
    const loginPromise = (async (): Promise<CachedSession> => {
      try {
        const { cookies, isUnifiOS, csrfToken } = await this.loginWithCredentials(client, config);

        // Cache for 25 minutes (UniFi sessions typically last 30 minutes)
        const expiresAt = Date.now() + 25 * 60 * 1000;
        const session: CachedSession = { cookies, csrfToken, isUnifiOS, expiresAt };

        // Store in cache
        sessionCache.set(cacheKey, session);
        logger.debug('unifi', 'Cached session from new login', { key: cacheKey, expiresIn: '25m' });

        // Clear any failed login cache on success
        failedLogins.delete(cacheKey);

        return session;
      } catch (error) {
        // Cache the failure to prevent immediate retries (especially on rate limits)
        // Use exponential backoff: 5min, 10min, 20min, 30min (max)
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const existingFailure = failedLogins.get(cacheKey);
        const retryCount = (existingFailure?.retryCount || 0) + 1;
        const backoffTTL = Math.min(
          FAILED_LOGIN_BASE_TTL * Math.pow(2, retryCount - 1),
          FAILED_LOGIN_MAX_TTL
        );
        const waitMinutes = Math.ceil(backoffTTL / 60000);

        failedLogins.set(cacheKey, {
          error: errorObj,
          expiresAt: Date.now() + backoffTTL,
          retryCount,
        });
        logger.debug('unifi', `Login failed, caching failure for ${waitMinutes}m (attempt ${retryCount})`, { key: cacheKey });
        throw error;
      }
    })();

    // Store the pending login promise so concurrent requests can wait for it
    pendingLogins.set(cacheKey, loginPromise);

    try {
      const session = await loginPromise;
      this.setAuthCookies(client, session.cookies, session.csrfToken);
      return { isUnifiOS: session.isUnifiOS };
    } finally {
      // Always clean up the pending login promise when done (success or failure)
      pendingLogins.delete(cacheKey);
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const unifiConfig = config as UnifiConfig;

    try {
      const client = this.createClient(unifiConfig);

      if (this.isApiKeyAuth(unifiConfig)) {
        // API Key authentication - use integration API
        logger.debug('unifi', 'Testing connection with API key');
        const response = await client.get('/proxy/network/integration/v1/sites');
        logger.debug('unifi', 'Sites API response', { data: response.data, type: typeof response.data });

        // Handle various response formats
        let sites: Array<{ name: string; id: string }> = [];
        if (Array.isArray(response.data)) {
          sites = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          sites = response.data.data;
        } else if (response.data && typeof response.data === 'object') {
          // Maybe it's a single site object or has a different structure
          logger.debug('unifi', 'Unexpected sites response structure', { keys: Object.keys(response.data) });
          // Try to extract sites from the response
          const possibleArrays = Object.values(response.data).filter(v => Array.isArray(v));
          if (possibleArrays.length > 0) {
            sites = possibleArrays[0] as Array<{ name: string; id: string }>;
          }
        }

        logger.debug('unifi', 'API key auth successful', { siteCount: sites.length, sites });

        return {
          success: true,
          message: `Connected to UniFi (API Key) - ${sites.length} site(s) found`,
          details: {
            sites: sites.map((s: { name: string; id: string }) => s.name || s.id || 'Unknown'),
            authMethod: 'apiKey',
          },
        };
      } else {
        // Username/password authentication - use cached session if available
        // This prevents rate limiting when health checks run frequently
        const { isUnifiOS } = await this.getAuthenticatedSession(client, unifiConfig);

        const apiPrefix = isUnifiOS ? '/proxy/network' : '';
        const siteInput = unifiConfig.site || 'default';

        // Resolve site name to ID
        const site = await this.resolveSiteIdStandard(client, siteInput, apiPrefix);
        logger.debug('unifi', `Using site ID: ${site} (input was: ${siteInput})`);

        const response = await client.get(`${apiPrefix}/api/s/${site}/stat/sysinfo`);
        const sysinfo = response.data.data?.[0] || {};

        return {
          success: true,
          message: `Connected to UniFi Controller${isUnifiOS ? ' (UniFi OS)' : ''}`,
          details: {
            version: sysinfo.version,
            hostname: sysinfo.hostname,
            isUnifiOS,
            authMethod: 'credentials',
          },
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('unifi', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const unifiConfig = config as UnifiConfig;
    const client = this.createClient(unifiConfig);

    if (this.isApiKeyAuth(unifiConfig)) {
      // Use integration API with API key
      const siteId = unifiConfig.site || 'default';

      switch (metric) {
        case 'clients':
          return this.getClientsApiKey(client, siteId);
        case 'devices':
          return this.getDevicesApiKey(client, siteId);
        case 'health':
          return this.getHealthApiKey(client, siteId);
        case 'networks':
          return this.getNetworksApiKey(client, siteId);
        case 'switch-ports':
          return this.getDevicesApiKey(client, siteId);
        case 'topology':
          return this.getTopologyApiKey(client, siteId);
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }
    } else {
      // Use standard API with credentials (use cached session if available)
      const { isUnifiOS } = await this.getAuthenticatedSession(client, unifiConfig);

      const apiPrefix = isUnifiOS ? '/proxy/network' : '';
      const siteInput = unifiConfig.site || 'default';

      // Resolve site name to ID
      const site = await this.resolveSiteIdStandard(client, siteInput, apiPrefix);

      switch (metric) {
        case 'clients':
          return this.getClients(client, site, apiPrefix);
        case 'devices':
          return this.getDevices(client, site, apiPrefix);
        case 'health':
          return this.getHealth(client, site, apiPrefix);
        case 'networks':
          return this.getNetworks(client, site, apiPrefix);
        case 'wlans':
          return this.getWlans(client, site, apiPrefix);
        case 'dpi':
          return this.getDpi(client, site, apiPrefix);
        case 'events':
          return this.getEvents(client, site, apiPrefix);
        case 'speedtest':
          return this.getSpeedTest(client, site, apiPrefix);
        case 'wan':
          return this.getWanInfo(client, site, apiPrefix);
        case 'switch-ports':
          return this.getDevices(client, site, apiPrefix);
        case 'topology':
          return this.getTopology(client, site, apiPrefix);
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }
    }
  }

  // Helper to extract data from paginated Integration API v1 responses
  private extractPaginatedData<T>(responseData: unknown): T[] {
    if (Array.isArray(responseData)) {
      return responseData;
    }
    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>;
      // Integration API v1 returns { offset, limit, count, totalCount, data: [...] }
      if (Array.isArray(data.data)) {
        return data.data;
      }
      // Try to find any array in the response
      const arrays = Object.values(data).filter(v => Array.isArray(v));
      if (arrays.length > 0) {
        return arrays[0] as T[];
      }
    }
    return [];
  }

  // API Key methods (Integration API v1)
  private async getClientsApiKey(client: AxiosInstance, siteId: string): Promise<{ clients: UnifiClient[]; summary: { total: number; wired: number; wireless: number } }> {
    // First get the site ID if we have a name
    const actualSiteId = await this.resolveSiteId(client, siteId);

    const response = await client.get(`/proxy/network/integration/v1/sites/${actualSiteId}/clients`);
    const rawClients = this.extractPaginatedData<Record<string, unknown>>(response.data);

    logger.debug('unifi', 'Raw clients from API', { count: rawClients.length, sample: rawClients[0] });

    const clients: UnifiClient[] = rawClients.map((c: Record<string, unknown>) => ({
      _id: c.id as string || c._id as string,
      mac: c.mac as string,
      hostname: c.hostname as string | undefined,
      name: c.name as string || c.hostname as string || 'Unknown',
      ip: c.ip as string || c.ipAddress as string,
      is_wired: c.type === 'WIRED' || c.is_wired as boolean,
      network: c.network as string || '',
      rx_bytes: c.rxBytes as number || c.rx_bytes as number || 0,
      tx_bytes: c.txBytes as number || c.tx_bytes as number || 0,
      uptime: c.uptime as number || 0,
    }));

    const wired = clients.filter(c => c.is_wired).length;
    const wireless = clients.length - wired;

    logger.debug('unifi', `Fetched ${clients.length} clients (${wired} wired, ${wireless} wireless)`);

    return {
      clients,
      summary: {
        total: clients.length,
        wired,
        wireless,
      },
    };
  }

  private async getDevicesApiKey(client: AxiosInstance, siteId: string): Promise<{ devices: UnifiDevice[] }> {
    const actualSiteId = await this.resolveSiteId(client, siteId);

    const response = await client.get(`/proxy/network/integration/v1/sites/${actualSiteId}/devices`);
    const rawDevices = this.extractPaginatedData<Record<string, unknown>>(response.data);

    logger.debug('unifi', 'Raw devices from API', { count: rawDevices.length, sample: rawDevices[0] });

    const devices: UnifiDevice[] = rawDevices.map((d: Record<string, unknown>) => {
      // Map device type from Integration API format to standard format
      // Integration API uses 'USW', 'UAP', 'UDM', etc. (uppercase)
      // Standard API uses 'usw', 'uap', 'udm', etc. (lowercase)
      const rawType = (d.type as string || '').toLowerCase();

      const device: UnifiDevice = {
        _id: d.id as string || d._id as string,
        mac: d.mac as string,
        name: d.name as string || 'Unknown',
        model: d.model as string,
        type: rawType,
        state: d.state === 'ONLINE' ? 1 : 0,
        adopted: d.adopted as boolean ?? true,
        uptime: d.uptime as number || 0,
        num_sta: d.numClients as number || d.num_sta as number || 0,
      };

      // Include port_table for switches and UDM/gateway devices
      // Integration API may use 'portTable' (camelCase) or 'port_table' (snake_case)
      const portTable = d.portTable || d.port_table;
      if ((rawType === 'usw' || rawType === 'udm') && Array.isArray(portTable)) {
        device.port_table = (portTable as Record<string, unknown>[]).map((p) => ({
          port_idx: (p.portIdx as number) || (p.port_idx as number) || 0,
          name: (p.name as string) || `Port ${(p.portIdx as number) || (p.port_idx as number) || 0}`,
          up: (p.up as boolean) ?? (p.state === 'UP'),
          enable: (p.enable as boolean) ?? (p.enabled as boolean) ?? true,
          speed: (p.speed as number) || 0,
          full_duplex: (p.fullDuplex as boolean) ?? (p.full_duplex as boolean) ?? false,
          poe_enable: (p.poeEnable as boolean) ?? (p.poe_enable as boolean),
          poe_power: (p.poePower as number) ?? (p.poe_power as number),
          rx_bytes: (p.rxBytes as number) || (p.rx_bytes as number) || 0,
          tx_bytes: (p.txBytes as number) || (p.tx_bytes as number) || 0,
          rx_packets: (p.rxPackets as number) || (p.rx_packets as number) || 0,
          tx_packets: (p.txPackets as number) || (p.tx_packets as number) || 0,
        }));
      }

      return device;
    });

    logger.debug('unifi', `Fetched ${devices.length} devices`);
    return { devices };
  }

  private async getHealthApiKey(client: AxiosInstance, siteId: string): Promise<{ health: UnifiHealth[] }> {
    // The integration API doesn't have a direct health endpoint, so we'll construct it from other data
    const actualSiteId = await this.resolveSiteId(client, siteId);

    try {
      const [clientsRes, devicesRes] = await Promise.all([
        client.get(`/proxy/network/integration/v1/sites/${actualSiteId}/clients`),
        client.get(`/proxy/network/integration/v1/sites/${actualSiteId}/devices`),
      ]);

      const clients = this.extractPaginatedData<Record<string, unknown>>(clientsRes.data);
      const devices = this.extractPaginatedData<Record<string, unknown>>(devicesRes.data);

      const wiredClients = clients.filter((c: Record<string, unknown>) => c.type === 'WIRED').length;
      const wirelessClients = clients.length - wiredClients;
      const onlineDevices = devices.filter((d: Record<string, unknown>) => d.state === 'ONLINE').length;

      const health: UnifiHealth[] = [
        {
          subsystem: 'lan',
          status: 'ok',
          num_user: wiredClients,
          num_guest: 0,
          num_iot: 0,
          tx_bytes: 0,
          rx_bytes: 0,
        },
        {
          subsystem: 'wlan',
          status: 'ok',
          num_user: wirelessClients,
          num_guest: 0,
          num_iot: 0,
          tx_bytes: 0,
          rx_bytes: 0,
        },
        {
          subsystem: 'devices',
          status: onlineDevices === devices.length ? 'ok' : 'warning',
          num_user: onlineDevices,
          num_guest: devices.length - onlineDevices,
          num_iot: 0,
          tx_bytes: 0,
          rx_bytes: 0,
        },
      ];

      logger.debug('unifi', 'Constructed health data from API');
      return { health };
    } catch (error) {
      logger.warn('unifi', 'Failed to construct health data', { error: String(error) });
      return { health: [] };
    }
  }

  private async getNetworksApiKey(client: AxiosInstance, siteId: string): Promise<{ networks: unknown[] }> {
    const actualSiteId = await this.resolveSiteId(client, siteId);

    try {
      const response = await client.get(`/proxy/network/integration/v1/sites/${actualSiteId}/networks`);
      const networks = this.extractPaginatedData<unknown>(response.data);
      logger.debug('unifi', `Fetched ${networks.length} networks`);
      return { networks };
    } catch (error) {
      logger.warn('unifi', 'Networks endpoint not available', { error: String(error) });
      return { networks: [] };
    }
  }

  private async resolveSiteId(client: AxiosInstance, siteIdOrName: string): Promise<string> {
    // If it looks like a UUID, use it directly
    if (siteIdOrName.includes('-') && siteIdOrName.length > 30) {
      return siteIdOrName;
    }

    // Check cache first
    const cacheKey = `api:${siteIdOrName}`;
    const cached = siteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('unifi', 'Using cached site ID', { siteIdOrName, siteId: cached.siteId });
      return cached.siteId;
    }

    // Otherwise, fetch sites and find by name
    try {
      const response = await client.get('/proxy/network/integration/v1/sites');
      logger.debug('unifi', 'resolveSiteId - Sites API response', { data: response.data, type: typeof response.data });

      // Handle various response formats
      let sites: Array<{ name: string; id: string }> = [];
      if (Array.isArray(response.data)) {
        sites = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        sites = response.data.data;
      } else if (response.data && typeof response.data === 'object') {
        const possibleArrays = Object.values(response.data).filter(v => Array.isArray(v));
        if (possibleArrays.length > 0) {
          sites = possibleArrays[0] as Array<{ name: string; id: string }>;
        }
      }

      logger.debug('unifi', 'resolveSiteId - Parsed sites', { siteCount: sites.length, sites });

      // Try to find by name (case-insensitive) or use 'default'
      const site = sites.find((s: { name: string; id: string }) =>
        s.name?.toLowerCase() === siteIdOrName.toLowerCase() ||
        (siteIdOrName === 'default' && sites.length === 1)
      );

      let resolvedId: string;
      if (site) {
        logger.debug('unifi', `Resolved site "${siteIdOrName}" to ID "${site.id}"`);
        resolvedId = site.id;
      } else if (sites.length === 1) {
        logger.debug('unifi', `Using only available site: ${sites[0].id}`);
        resolvedId = sites[0].id;
      } else if (sites.length > 0) {
        logger.debug('unifi', `Using first site: ${sites[0].id}`);
        resolvedId = sites[0].id;
      } else {
        resolvedId = siteIdOrName;
      }

      // Cache the resolved site ID
      siteCache.set(cacheKey, { siteId: resolvedId, expiresAt: Date.now() + SITE_CACHE_TTL });
      return resolvedId;
    } catch (error) {
      logger.warn('unifi', 'Failed to resolve site ID, using as-is', { siteIdOrName });
      return siteIdOrName;
    }
  }

  // Resolve site name to site ID for standard API (username/password auth)
  private async resolveSiteIdStandard(client: AxiosInstance, siteNameOrId: string, apiPrefix: string): Promise<string> {
    // Common site IDs to try
    const commonIds = ['default', 'super'];

    // If it looks like a standard ID, use it directly
    if (commonIds.includes(siteNameOrId.toLowerCase())) {
      return siteNameOrId.toLowerCase();
    }

    // Check cache first
    const cacheKey = `standard:${apiPrefix}:${siteNameOrId}`;
    const cached = siteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('unifi', 'Using cached site ID (standard)', { siteNameOrId, siteId: cached.siteId });
      return cached.siteId;
    }

    try {
      // Fetch the list of sites to find the correct ID
      const response = await client.get(`${apiPrefix}/api/self/sites`);
      const sites = response.data.data || [];

      logger.debug('unifi', 'Fetched sites for resolution', {
        count: sites.length,
        sites: sites.map((s: { name: string; desc: string }) => ({ name: s.name, desc: s.desc }))
      });

      // Try to find by name (the API uses 'name' as ID, 'desc' as display name)
      const site = sites.find((s: { name: string; desc: string }) =>
        s.name === siteNameOrId ||
        s.desc?.toLowerCase() === siteNameOrId.toLowerCase() ||
        s.name?.toLowerCase() === siteNameOrId.toLowerCase()
      );

      let resolvedId: string;
      if (site) {
        logger.debug('unifi', `Resolved site "${siteNameOrId}" to ID "${site.name}"`);
        resolvedId = site.name;
      } else if (sites.length === 1) {
        logger.debug('unifi', `Using only available site: ${sites[0].name}`);
        resolvedId = sites[0].name;
      } else {
        logger.warn('unifi', `Could not resolve site "${siteNameOrId}", trying "default"`);
        resolvedId = 'default';
      }

      // Cache the resolved site ID
      siteCache.set(cacheKey, { siteId: resolvedId, expiresAt: Date.now() + SITE_CACHE_TTL });
      return resolvedId;
    } catch (error) {
      logger.warn('unifi', 'Failed to fetch sites, using "default"', { error: String(error) });
      return 'default';
    }
  }

  // Standard API methods (username/password auth)
  private async getClients(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ clients: UnifiClient[]; summary: { total: number; wired: number; wireless: number } }> {
    const url = `${apiPrefix}/api/s/${site}/stat/sta`;
    const cacheKey = `${client.defaults.baseURL}:${url}`;

    // Use endpoint cache to share data across metrics
    const rawClients = await getCachedEndpoint<Record<string, unknown>[]>(
      cacheKey,
      async () => {
        logger.debug('unifi', 'Fetching clients (cache miss)', { url });
        const response = await client.get(url);
        logger.debug('unifi', 'Clients response received', { status: response.status, dataCount: response.data?.data?.length });
        return response.data.data || [];
      }
    );

    const clients: UnifiClient[] = rawClients.map((c: Record<string, unknown>) => ({
      _id: c._id as string,
      mac: c.mac as string,
      hostname: c.hostname as string | undefined,
      name: c.name as string | undefined,
      ip: c.ip as string,
      is_wired: c.is_wired as boolean,
      network: c.network as string,
      rx_bytes: c.rx_bytes as number,
      tx_bytes: c.tx_bytes as number,
      uptime: c.uptime as number,
    }));

    const wired = clients.filter(c => c.is_wired).length;
    const wireless = clients.length - wired;

    logger.debug('unifi', `Fetched ${clients.length} clients (${wired} wired, ${wireless} wireless)`);

    return {
      clients,
      summary: {
        total: clients.length,
        wired,
        wireless,
      },
    };
  }

  private async getDevices(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ devices: UnifiDevice[] }> {
    const url = `${apiPrefix}/api/s/${site}/stat/device`;
    const cacheKey = `${client.defaults.baseURL}:${url}`;

    // Use endpoint cache - devices endpoint is used by multiple metrics (devices, switch-ports, topology, wan)
    const rawDevices = await getCachedEndpoint<Record<string, unknown>[]>(
      cacheKey,
      async () => {
        logger.debug('unifi', 'Fetching devices (cache miss)', { url });
        const response = await client.get(url);
        logger.debug('unifi', 'Devices response received', { status: response.status, dataCount: response.data?.data?.length });
        return response.data.data || [];
      }
    );

    const devices: UnifiDevice[] = rawDevices.map((d: Record<string, unknown>) => {
      const device: UnifiDevice = {
        _id: d._id as string,
        mac: d.mac as string,
        name: d.name as string,
        model: d.model as string,
        type: d.type as string,
        state: d.state as number,
        adopted: d.adopted as boolean,
        uptime: d.uptime as number,
        num_sta: d.num_sta as number || 0,
      };

      // Include port_table for switches and UDM/gateway devices
      if ((d.type === 'usw' || d.type === 'udm') && Array.isArray(d.port_table)) {
        device.port_table = (d.port_table as Record<string, unknown>[]).map((p) => ({
          port_idx: p.port_idx as number,
          name: (p.name as string) || `Port ${p.port_idx}`,
          up: p.up as boolean,
          enable: p.enable as boolean ?? true,
          speed: p.speed as number || 0,
          full_duplex: p.full_duplex as boolean ?? false,
          poe_enable: p.poe_enable as boolean,
          poe_power: p.poe_power as number,
          rx_bytes: p.rx_bytes as number || 0,
          tx_bytes: p.tx_bytes as number || 0,
          rx_packets: p.rx_packets as number || 0,
          tx_packets: p.tx_packets as number || 0,
          media: p.media as string,
          port_poe: p.port_poe as boolean,
          is_uplink: p.is_uplink as boolean,
        } as UnifiSwitchPort));
      }

      return device;
    });

    logger.debug('unifi', `Fetched ${devices.length} devices`);
    return { devices };
  }

  /**
   * Get network topology - connections between switches based on uplink/downlink data
   */
  private async getTopology(client: AxiosInstance, site: string, apiPrefix: string): Promise<{
    links: Array<{
      localDeviceId: string;
      localDeviceName: string;
      localDeviceMac: string;
      localPort: number;
      localPortName: string;
      remoteDeviceId: string;
      remoteDeviceName: string;
      remoteDeviceMac: string;
      remotePort: number;
      remotePortName: string;
      linkType: 'uplink' | 'downlink';
    }>;
  }> {
    const url = `${apiPrefix}/api/s/${site}/stat/device`;
    const cacheKey = `${client.defaults.baseURL}:${url}`;

    // Use endpoint cache - shares data with getDevices
    const rawDevices = await getCachedEndpoint<Record<string, unknown>[]>(
      cacheKey,
      async () => {
        logger.debug('unifi', 'Fetching topology data (cache miss)', { url });
        const response = await client.get(url);
        return response.data.data || [];
      }
    );

    const links: Array<{
      localDeviceId: string;
      localDeviceName: string;
      localDeviceMac: string;
      localPort: number;
      localPortName: string;
      remoteDeviceId: string;
      remoteDeviceName: string;
      remoteDeviceMac: string;
      remotePort: number;
      remotePortName: string;
      linkType: 'uplink' | 'downlink';
    }> = [];

    // Build a map of MAC -> device info for lookups
    const deviceMap = new Map<string, { id: string; name: string; mac: string }>();
    for (const d of rawDevices) {
      deviceMap.set((d.mac as string)?.toLowerCase(), {
        id: d._id as string,
        name: d.name as string || d.model as string,
        mac: d.mac as string,
      });
    }

    // Process each device's uplink information
    for (const d of rawDevices) {
      const deviceId = d._id as string;
      const deviceName = d.name as string || d.model as string;
      const deviceMac = d.mac as string;

      // Check uplink object - this tells us what this device connects TO (upstream)
      const uplink = d.uplink as Record<string, unknown> | undefined;
      if (uplink && uplink.uplink_mac) {
        const uplinkMac = (uplink.uplink_mac as string)?.toLowerCase();
        const uplinkDevice = deviceMap.get(uplinkMac);

        // Log raw uplink data for debugging port numbers
        logger.debug('unifi', `Uplink data for ${deviceName}`, {
          uplink_mac: uplink.uplink_mac,
          uplink_port: uplink.uplink_port,
          uplink_remote_port: uplink.uplink_remote_port,
          port_idx: uplink.port_idx,
          uplinkKeys: Object.keys(uplink),
        });

        if (uplinkDevice) {
          // port_idx = local device's port going upstream
          // uplink_remote_port = upstream device's port where we connect
          const localPort = (uplink.port_idx as number) || 0;
          const remotePort = (uplink.uplink_remote_port as number) || 0;

          // Get port names from port_table if available
          const portTable = d.port_table as Array<{ port_idx: number; name?: string }> | undefined;
          const localPortInfo = portTable?.find(p => p.port_idx === localPort);

          links.push({
            localDeviceId: deviceId,
            localDeviceName: deviceName,
            localDeviceMac: deviceMac,
            localPort: localPort,
            localPortName: localPortInfo?.name || `Port ${localPort}`,
            remoteDeviceId: uplinkDevice.id,
            remoteDeviceName: uplinkDevice.name,
            remoteDeviceMac: uplinkDevice.mac,
            remotePort: remotePort,
            remotePortName: `Port ${remotePort}`,
            linkType: 'uplink',
          });
        }
      }

      // Note: downlink_table is skipped because it doesn't provide the remote port number.
      // Connections are derived from uplink data only, which has complete port information.
    }

    logger.debug('unifi', `Found ${links.length} topology links`);
    return { links };
  }

  /**
   * Get topology using Integration API (API key auth)
   * Uses the devices endpoint and extracts uplink relationships
   */
  private async getTopologyApiKey(client: AxiosInstance, siteId: string): Promise<{
    links: Array<{
      localDeviceId: string;
      localDeviceName: string;
      localDeviceMac: string;
      localPort: number;
      localPortName: string;
      remoteDeviceId: string;
      remoteDeviceName: string;
      remoteDeviceMac: string;
      remotePort: number;
      remotePortName: string;
      linkType: 'uplink' | 'downlink';
    }>;
  }> {
    // First resolve the site ID
    const actualSiteId = await this.resolveSiteId(client, siteId);

    // Fetch all devices using the Integration API endpoint
    const url = `/proxy/network/integration/v1/sites/${actualSiteId}/devices`;
    logger.debug('unifi', 'Fetching topology (API key)', { url });
    const response = await client.get(url);
    const rawDevices = this.extractPaginatedData<Record<string, unknown>>(response.data);

    const links: Array<{
      localDeviceId: string;
      localDeviceName: string;
      localDeviceMac: string;
      localPort: number;
      localPortName: string;
      remoteDeviceId: string;
      remoteDeviceName: string;
      remoteDeviceMac: string;
      remotePort: number;
      remotePortName: string;
      linkType: 'uplink' | 'downlink';
    }> = [];

    // Build MAC -> device info map
    const deviceMap = new Map<string, { id: string; name: string; mac: string }>();
    for (const d of rawDevices) {
      deviceMap.set((d.mac as string)?.toLowerCase(), {
        id: d.id as string,
        name: d.name as string || d.model as string,
        mac: d.mac as string,
      });
    }

    // Process uplink relationships (same logic as getTopology)
    // Integration API may use camelCase (uplinkMac) or snake_case (uplink_mac)
    for (const d of rawDevices) {
      const deviceId = d.id as string;
      const deviceName = d.name as string || d.model as string;
      const deviceMac = d.mac as string;

      const uplink = d.uplink as Record<string, unknown> | undefined;
      // Try both camelCase (Integration API) and snake_case (standard API) field names
      const uplinkMacRaw = uplink?.uplinkMac || uplink?.uplink_mac;
      if (uplink && uplinkMacRaw) {
        const uplinkMac = (uplinkMacRaw as string)?.toLowerCase();
        const uplinkDevice = deviceMap.get(uplinkMac);

        if (uplinkDevice) {
          // port_idx / portIdx = local device's port going upstream
          // uplink_remote_port / uplinkRemotePort = upstream device's port where we connect
          const localPort = (uplink.portIdx as number) || (uplink.port_idx as number) || 0;
          const remotePort = (uplink.uplinkRemotePort as number) || (uplink.uplink_remote_port as number) || 0;

          links.push({
            localDeviceId: deviceId,
            localDeviceName: deviceName,
            localDeviceMac: deviceMac,
            localPort,
            localPortName: `Port ${localPort}`,
            remoteDeviceId: uplinkDevice.id,
            remoteDeviceName: uplinkDevice.name,
            remoteDeviceMac: uplinkDevice.mac,
            remotePort,
            remotePortName: `Port ${remotePort}`,
            linkType: 'uplink',
          });
        }
      }
    }

    logger.debug('unifi', `Found ${links.length} topology links (API key)`);
    return { links };
  }

  private async getHealth(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ health: UnifiHealth[] }> {
    const url = `${apiPrefix}/api/s/${site}/stat/health`;
    const cacheKey = `${client.defaults.baseURL}:${url}`;

    // Use endpoint cache - health endpoint is also used by wan metric
    const rawHealth = await getCachedEndpoint<Record<string, unknown>[]>(
      cacheKey,
      async () => {
        logger.debug('unifi', 'Fetching health (cache miss)', { url });
        const response = await client.get(url);
        logger.debug('unifi', 'Health response received', { status: response.status, dataCount: response.data?.data?.length });
        return response.data.data || [];
      }
    );

    // Log the WAN subsystem to see what fields are available
    const wanHealth = rawHealth.find((h: Record<string, unknown>) => h.subsystem === 'wan');
    if (wanHealth) {
      logger.debug('unifi', 'WAN health data', {
        keys: Object.keys(wanHealth),
        wan_ip: wanHealth.wan_ip,
        wan2_ip: wanHealth.wan2_ip,
        gateways: wanHealth.gateways,
        uptime: wanHealth.uptime,
        nameservers: wanHealth.nameservers,
      });
    }

    const health: UnifiHealth[] = rawHealth.map((h: Record<string, unknown>) => ({
      subsystem: h.subsystem as string,
      status: h.status as string,
      num_user: h.num_user as number || 0,
      num_guest: h.num_guest as number || 0,
      num_iot: h.num_iot as number || 0,
      tx_bytes: (h['tx_bytes-r'] as number) || 0,
      rx_bytes: (h['rx_bytes-r'] as number) || 0,
    }));

    logger.debug('unifi', `Fetched health for ${health.length} subsystems`);
    return { health };
  }

  private async getNetworks(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ networks: unknown[] }> {
    const response = await client.get(`${apiPrefix}/api/s/${site}/rest/networkconf`);
    const networks = response.data.data || [];

    logger.debug('unifi', `Fetched ${networks.length} networks`);
    return { networks };
  }

  // Username/password only methods
  private async getWlans(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ wlans: WlanInfo[] }> {
    try {
      const wlanUrl = `${apiPrefix}/api/s/${site}/rest/wlanconf`;
      const clientsUrl = `${apiPrefix}/api/s/${site}/stat/sta`;
      const wlanCacheKey = `${client.defaults.baseURL}:${wlanUrl}`;
      const clientsCacheKey = `${client.defaults.baseURL}:${clientsUrl}`;

      // Fetch WLAN config (name, security, enabled, etc.) - with caching
      const rawWlans = await getCachedEndpoint<Record<string, unknown>[]>(
        wlanCacheKey,
        async () => {
          logger.debug('unifi', 'Fetching WLAN config (cache miss)', { url: wlanUrl });
          const response = await client.get(wlanUrl);
          return response.data.data || [];
        }
      );

      logger.debug('unifi', `Fetched ${rawWlans.length} WLAN configs`, {
        wlanNames: rawWlans.map((w: Record<string, unknown>) => w.name)
      });

      // Calculate client counts from the active clients list
      // This is more reliable than /stat/wlan which may not exist
      let wlanStats: Map<string, number> = new Map();
      let wlanStatsLower: Map<string, number> = new Map(); // For case-insensitive fallback
      try {
        // Use endpoint cache - shares data with getClients
        const clients = await getCachedEndpoint<Record<string, unknown>[]>(
          clientsCacheKey,
          async () => {
            logger.debug('unifi', 'Fetching clients for WLANs (cache miss)', { url: clientsUrl });
            const response = await client.get(clientsUrl);
            return response.data.data || [];
          }
        );

        // Log some sample client data to see what fields are available
        if (clients.length > 0) {
          const wirelessClients = clients.filter((c: Record<string, unknown>) => !c.is_wired);
          logger.debug('unifi', `Found ${wirelessClients.length} wireless clients out of ${clients.length} total`, {
            sampleClient: wirelessClients[0] ? {
              essid: wirelessClients[0].essid,
              ap_mac: wirelessClients[0].ap_mac,
              network: wirelessClients[0].network,
              bssid: wirelessClients[0].bssid,
              radio: wirelessClients[0].radio,
            } : 'no wireless clients'
          });
        }

        // Count wireless clients by ESSID (SSID name)
        for (const c of clients) {
          if (!c.is_wired && c.essid) {
            const essid = c.essid as string;
            wlanStats.set(essid, (wlanStats.get(essid) || 0) + 1);
            wlanStatsLower.set(essid.toLowerCase(), (wlanStatsLower.get(essid.toLowerCase()) || 0) + 1);
          }
        }
        logger.debug('unifi', `Calculated WLAN client counts from ${clients.length} clients`, {
          wlanStats: Object.fromEntries(wlanStats),
          wlanStatsLower: Object.fromEntries(wlanStatsLower)
        });
      } catch (statsError) {
        logger.debug('unifi', 'Failed to fetch clients for WLAN stats', { error: String(statsError) });
      }

      const wlans: WlanInfo[] = rawWlans.map((w: Record<string, unknown>) => {
        const name = w.name as string;
        const id = w._id as string;
        // Get client count from calculated stats - try exact match first, then case-insensitive
        let numSta = wlanStats.get(name);
        if (numSta === undefined) {
          numSta = wlanStatsLower.get(name.toLowerCase()) ?? 0;
          if (numSta > 0) {
            logger.debug('unifi', `Used case-insensitive match for WLAN "${name}", found ${numSta} clients`);
          }
        }

        return {
          _id: id,
          name,
          enabled: w.enabled as boolean ?? true,
          security: w.security as string || 'open',
          is_guest: w.is_guest as boolean ?? false,
          num_sta: numSta,
        };
      });

      logger.debug('unifi', `Returning ${wlans.length} WLANs with client counts`, {
        wlans: wlans.map(w => ({ name: w.name, num_sta: w.num_sta, enabled: w.enabled }))
      });
      return { wlans };
    } catch (error) {
      logger.warn('unifi', 'WLANs endpoint not available (requires username/password auth)', { error: String(error) });
      return { wlans: [] };
    }
  }

  private parseDpiResponse(responseData: unknown): DpiCategory[] {
    if (!responseData || typeof responseData !== 'object') return [];

    const data = responseData as Record<string, unknown>;
    let rawDpi: Record<string, unknown>[] = [];

    // Try various response formats
    if (data.categories && Array.isArray(data.categories)) {
      rawDpi = data.categories;
    } else if (data.dpiCategories && Array.isArray(data.dpiCategories)) {
      rawDpi = data.dpiCategories;
    } else if (data.data && Array.isArray(data.data)) {
      const firstItem = data.data[0] as Record<string, unknown> | undefined;
      if (firstItem && Array.isArray(firstItem.by_cat)) {
        rawDpi = firstItem.by_cat as Record<string, unknown>[];
      } else if (firstItem && ('cat' in firstItem || 'app' in firstItem)) {
        rawDpi = data.data as Record<string, unknown>[];
      }
    }

    if (rawDpi.length === 0) return [];

    return rawDpi.map((d: Record<string, unknown>) => ({
      cat: (d.cat ?? -1) as number,
      app: (d.app ?? 0) as number,
      rx_bytes: (d.rx_bytes ?? 0) as number,
      tx_bytes: (d.tx_bytes ?? 0) as number,
      rx_packets: (d.rx_packets ?? 0) as number,
      tx_packets: (d.tx_packets ?? 0) as number,
    })).filter(d => d.cat !== -1);
  }

  private async getDpi(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ dpi: DpiCategory[] }> {
    // Try multiple DPI endpoints - some need POST, some need GET
    const postEndpoints = [
      `${apiPrefix}/api/s/${site}/stat/sitedpi`,
      `${apiPrefix}/api/s/${site}/stat/dpi`,
    ];

    // Try POST first (documented method)
    for (const endpoint of postEndpoints) {
      try {
        const response = await client.post(endpoint, {
          type: 'by_cat',
          attrs: ['cat', 'app', 'rx_bytes', 'tx_bytes'],
        });

        logger.info('unifi', `DPI POST ${endpoint} response`, {
          rawDataSample: JSON.stringify(response.data).slice(0, 1000),
        });

        const parsed = this.parseDpiResponse(response.data);
        if (parsed.length > 0) {
          logger.info('unifi', `Got ${parsed.length} DPI categories from POST ${endpoint}`);
          return { dpi: parsed };
        }
      } catch (error) {
        logger.debug('unifi', `DPI POST ${endpoint} failed`, { error: String(error) });
      }
    }

    // Try GET with query params as fallback
    for (const endpoint of postEndpoints) {
      try {
        const response = await client.get(endpoint, {
          params: { type: 'by_cat' },
        });

        logger.info('unifi', `DPI GET ${endpoint} response`, {
          rawDataSample: JSON.stringify(response.data).slice(0, 1000),
        });

        const parsed = this.parseDpiResponse(response.data);
        if (parsed.length > 0) {
          logger.info('unifi', `Got ${parsed.length} DPI categories from GET ${endpoint}`);
          return { dpi: parsed };
        }
      } catch (error) {
        logger.debug('unifi', `DPI GET ${endpoint} failed`, { error: String(error) });
      }
    }

    // Try newer v2/proxy API endpoints
    const v2Endpoints = [
      `${apiPrefix}/v2/api/site/${site}/stats/dpi`,
      `${apiPrefix}/proxy/network/v2/api/site/${site}/stats/dpi`,
    ];

    for (const endpoint of v2Endpoints) {
      try {
        const response = await client.get(endpoint);
        logger.info('unifi', `DPI v2 ${endpoint} response`, {
          rawDataSample: JSON.stringify(response.data).slice(0, 1000),
        });

        const parsed = this.parseDpiResponse(response.data);
        if (parsed.length > 0) {
          logger.info('unifi', `Got ${parsed.length} DPI categories from v2 ${endpoint}`);
          return { dpi: parsed };
        }
      } catch (error) {
        logger.debug('unifi', `DPI v2 ${endpoint} failed`, { error: String(error) });
      }
    }

    // Try client-based DPI as last resort - aggregate from all clients
    try {
      logger.debug('unifi', 'Trying client-based DPI aggregation');
      const clientDpiResponse = await client.post(`${apiPrefix}/api/s/${site}/stat/stadpi`, {
        type: 'by_cat',
      });

      logger.info('unifi', 'Client DPI response', {
        rawDataSample: JSON.stringify(clientDpiResponse.data).slice(0, 1000),
      });

      const clientData = clientDpiResponse.data?.data || [];
      if (Array.isArray(clientData) && clientData.length > 0) {
        // Aggregate DPI data from all clients
        const aggregated = new Map<number, { rx_bytes: number; tx_bytes: number; rx_packets: number; tx_packets: number }>();

        for (const clientEntry of clientData) {
          const byCat = clientEntry.by_cat || [];
          for (const cat of byCat) {
            const catId = cat.cat as number;
            if (catId === undefined) continue;

            const existing = aggregated.get(catId) || { rx_bytes: 0, tx_bytes: 0, rx_packets: 0, tx_packets: 0 };
            existing.rx_bytes += (cat.rx_bytes || 0) as number;
            existing.tx_bytes += (cat.tx_bytes || 0) as number;
            existing.rx_packets += (cat.rx_packets || 0) as number;
            existing.tx_packets += (cat.tx_packets || 0) as number;
            aggregated.set(catId, existing);
          }
        }

        if (aggregated.size > 0) {
          const dpi: DpiCategory[] = Array.from(aggregated.entries()).map(([cat, data]) => ({
            cat,
            app: 0,
            ...data,
          }));

          logger.info('unifi', `Aggregated DPI data from ${clientData.length} clients into ${dpi.length} categories`);
          return { dpi };
        }
      }
    } catch (error) {
      logger.debug('unifi', 'Client DPI endpoint failed', { error: String(error) });
    }

    logger.warn('unifi', 'All DPI endpoints failed or returned no data');
    return { dpi: [] };
  }

  private async getEvents(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ events: NetworkEvent[] }> {
    try {
      const response = await client.get(`${apiPrefix}/api/s/${site}/stat/event`, {
        params: { _limit: 50 },
      });
      const rawEvents = response.data.data || [];

      const events: NetworkEvent[] = rawEvents.map((e: Record<string, unknown>) => ({
        _id: e._id as string,
        key: e.key as string,
        msg: e.msg as string,
        time: e.time as number,
        datetime: e.datetime as string,
        subsystem: e.subsystem as string || 'system',
      }));

      logger.debug('unifi', `Fetched ${events.length} events`);
      return { events };
    } catch (error) {
      logger.warn('unifi', 'Events endpoint not available (requires username/password auth)', { error: String(error) });
      return { events: [] };
    }
  }

  private async getSpeedTest(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ speedtest: SpeedTestResult | null; message?: string }> {
    // Try multiple endpoints as UniFi versions differ
    const endpoints = [
      `${apiPrefix}/api/s/${site}/stat/speedtest-status`,
      `${apiPrefix}/api/s/${site}/stat/report/daily.speedtest`,
      `${apiPrefix}/api/s/${site}/stat/report/5minutes.speedtest`,
      `${apiPrefix}/api/s/${site}/rest/setting/super_speedtest`,
    ];

    for (const endpoint of endpoints) {
      try {
        logger.debug('unifi', `Trying speed test endpoint: ${endpoint}`);
        const response = await client.get(endpoint);
        let results = response.data.data || response.data || [];

        logger.debug('unifi', `Speed test endpoint ${endpoint} response`, {
          hasData: !!response.data.data,
          rawDataType: typeof response.data,
          resultsLength: Array.isArray(results) ? results.length : 'not array',
          sampleResult: Array.isArray(results) && results[0] ? Object.keys(results[0]) : 'no data'
        });

        // Handle array or single object
        if (!Array.isArray(results)) {
          results = [results];
        }

        if (results.length > 0) {
          const latest = results[results.length - 1] as Record<string, unknown>; // Get most recent

          logger.debug('unifi', `Speed test latest result from ${endpoint}`, {
            latest: latest ? {
              xput_download: latest.xput_download,
              xput_upload: latest.xput_upload,
              download: latest.download,
              upload: latest.upload,
              latency: latest.latency,
              time: latest.time,
              keys: Object.keys(latest)
            } : 'null'
          });

          // Handle different response formats
          const speedtest: SpeedTestResult = {
            xput_download: (latest.xput_download as number) || (latest.download as number) || (latest.server_download as number) || 0,
            xput_upload: (latest.xput_upload as number) || (latest.upload as number) || (latest.server_upload as number) || 0,
            latency: (latest.latency as number) || (latest.ping as number) || (latest.server_latency as number) || 0,
            rundate: (latest.rundate as number) || (latest.time as number) || (latest.datetime as number) || Date.now(),
            status_download: latest.status_download as number || 0,
            status_upload: latest.status_upload as number || 0,
            status_ping: latest.status_ping as number || 0,
          };

          if (speedtest.xput_download > 0 || speedtest.xput_upload > 0) {
            logger.debug('unifi', 'Fetched speed test results', {
              endpoint,
              download: speedtest.xput_download,
              upload: speedtest.xput_upload
            });
            return { speedtest };
          }
        }
      } catch (error) {
        const axiosError = error as { response?: { status?: number } };
        // Only log non-404 errors
        if (axiosError.response?.status !== 404 && axiosError.response?.status !== 400) {
          logger.debug('unifi', `Speed test endpoint ${endpoint} failed`, { error: String(error) });
        }
      }
    }

    logger.debug('unifi', 'No speed test results available from any endpoint');
    return {
      speedtest: null,
      message: 'No speed test data available. Run a speed test from the UniFi Console to see results.'
    };
  }

  private async getWanInfo(client: AxiosInstance, site: string, apiPrefix: string): Promise<{ wan: WanInfo }> {
    try {
      const healthUrl = `${apiPrefix}/api/s/${site}/stat/health`;
      const deviceUrl = `${apiPrefix}/api/s/${site}/stat/device`;
      const healthCacheKey = `${client.defaults.baseURL}:${healthUrl}`;
      const deviceCacheKey = `${client.defaults.baseURL}:${deviceUrl}`;

      // Fetch health data and device data in parallel, using endpoint cache
      // This shares cached data with getHealth and getDevices
      const [rawHealth, rawDevices] = await Promise.all([
        getCachedEndpoint<Record<string, unknown>[]>(
          healthCacheKey,
          async () => {
            logger.debug('unifi', 'Fetching health for WAN (cache miss)', { url: healthUrl });
            const response = await client.get(healthUrl);
            return response.data.data || [];
          }
        ),
        getCachedEndpoint<Record<string, unknown>[]>(
          deviceCacheKey,
          async () => {
            logger.debug('unifi', 'Fetching devices for WAN (cache miss)', { url: deviceUrl });
            const response = await client.get(deviceUrl);
            return response.data.data || [];
          }
        ),
      ]);

      const wanHealth = rawHealth.find((h: Record<string, unknown>) => h.subsystem === 'wan');

      // Find the gateway device (UDM, USG, etc.) for detailed WAN info
      const gateway = rawDevices.find((d: Record<string, unknown>) =>
        d.type === 'ugw' || d.type === 'udm' || d.type === 'uxg'
      );

      // Extract WAN info from gateway device
      let wan1Data: Record<string, unknown> | null = null;
      let wan2Data: Record<string, unknown> | null = null;
      let uplinkData: Record<string, unknown> | null = null;
      if (gateway) {
        wan1Data = gateway.wan1 as Record<string, unknown> | null;
        wan2Data = gateway.wan2 as Record<string, unknown> | null;
        uplinkData = gateway.uplink as Record<string, unknown> | null;

        logger.debug('unifi', 'Gateway WAN interfaces', {
          gwType: gateway.type,
          gwName: gateway.name,
          wan1_ip: wan1Data?.ip,
          wan1_up: wan1Data?.up,
          wan1_uptime: uplinkData?.uptime,
          wan2_ip: wan2Data?.ip,
          wan2_up: wan2Data?.up,
        });
      }

      if (!wanHealth && !gateway) {
        logger.debug('unifi', 'No WAN health or gateway data found');
        return {
          wan: {
            wan_ip: null,
            wan2_ip: null,
            wan1_status: 'unknown',
            wan2_status: 'unknown',
            gw_name: null,
            gw_mac: null,
            gw_version: null,
            wan1_isp_name: null,
            wan1_isp_organization: null,
            wan2_isp_name: null,
            wan2_isp_organization: null,
            wan1_netmask: null,
            wan2_netmask: null,
            wan1_uptime: null,
            wan2_uptime: null,
            wan1_tx_bytes: 0,
            wan1_rx_bytes: 0,
            wan2_tx_bytes: 0,
            wan2_rx_bytes: 0,
          }
        };
      }

      // Extract uptime for each WAN interface
      // WAN1 uptime comes from the uplink object
      let wan1_uptime: number | null = null;
      if (uplinkData?.uptime) {
        wan1_uptime = Number(uplinkData.uptime) || null;
      }
      // Fallback to gw_system-stats or gateway uptime
      if (!wan1_uptime && wanHealth) {
        const gwStats = wanHealth['gw_system-stats'] as Record<string, unknown> | undefined;
        if (gwStats?.uptime) {
          wan1_uptime = Number(gwStats.uptime) || null;
        }
      }
      if (!wan1_uptime && gateway?.uptime) {
        wan1_uptime = Number(gateway.uptime) || null;
      }

      // WAN2 uptime - UniFi API doesn't provide separate WAN2 uptime
      // The uplink object only tracks primary WAN uptime
      const wan2_uptime: number | null = null;

      // Get WAN IPs from gateway wan1/wan2 objects (most reliable source)
      let wan1_ip: string | null = (wan1Data?.ip as string) || null;
      let wan2_ip: string | null = (wan2Data?.ip as string) || null;
      let wan1_up = wan1Data?.up as boolean | undefined;
      let wan2_up = wan2Data?.up as boolean | undefined;

      // Fallback to health data for WAN1 IP
      if (!wan1_ip && wanHealth?.wan_ip) {
        wan1_ip = wanHealth.wan_ip as string;
      }

      // Also check for wan2_ip directly in health data
      if (!wan2_ip && wanHealth?.wan2_ip) {
        wan2_ip = wanHealth.wan2_ip as string;
      }

      logger.debug('unifi', 'WAN IPs resolved', { wan1_ip, wan2_ip, wan1_up, wan2_up });

      // Try to detect ISP for WAN2 from mac_table hostname
      let wan2_isp_name: string | null = null;
      if (wan2Data?.mac_table) {
        const macTable = wan2Data.mac_table as Array<Record<string, unknown>>;
        const gateway_entry = macTable[0]; // Usually the gateway/ISP device
        const hostname = (gateway_entry?.hostname as string) || '';

        // Detect ISP from hostname patterns
        if (hostname.toLowerCase().includes('vz') || hostname.toLowerCase().includes('verizon')) {
          wan2_isp_name = 'Verizon';
        } else if (hostname.toLowerCase().includes('comcast') || hostname.toLowerCase().includes('xfinity')) {
          wan2_isp_name = 'Comcast/Xfinity';
        } else if (hostname.toLowerCase().includes('att') || hostname.toLowerCase().includes('at&t')) {
          wan2_isp_name = 'AT&T';
        } else if (hostname.toLowerCase().includes('spectrum') || hostname.toLowerCase().includes('charter')) {
          wan2_isp_name = 'Spectrum';
        } else if (hostname.toLowerCase().includes('tmobile') || hostname.toLowerCase().includes('t-mobile')) {
          wan2_isp_name = 'T-Mobile';
        } else if (hostname && hostname !== '?') {
          wan2_isp_name = hostname; // Use hostname as fallback
        }

        logger.debug('unifi', 'WAN2 ISP detection', { hostname, detected_isp: wan2_isp_name });
      }

      const wan: WanInfo = {
        wan_ip: wan1_ip,
        wan2_ip,
        wan1_status: (wanHealth?.status as string) || (wan1_up ? 'ok' : 'unknown'),
        wan2_status: wan2_up === true ? 'ok' : (wan2_up === false ? 'down' : 'unknown'),
        gw_name: (wanHealth?.gw_name as string) || (gateway?.name as string) || null,
        gw_mac: (wanHealth?.gw_mac as string) || (gateway?.mac as string) || null,
        gw_version: (wanHealth?.gw_version as string) || (gateway?.version as string) || null,
        wan1_isp_name: (wanHealth?.isp_name as string) || null,
        wan1_isp_organization: (wanHealth?.isp_organization as string) || null,
        wan2_isp_name,
        wan2_isp_organization: null, // Not available for WAN2
        wan1_netmask: (wanHealth?.netmask as string) || (wan1Data?.netmask as string) || null,
        wan2_netmask: (wan2Data?.netmask as string) || null,
        wan1_uptime,
        wan2_uptime,
        wan1_tx_bytes: (wanHealth?.['tx_bytes-r'] as number) || (wan1Data?.['tx_bytes-r'] as number) || 0,
        wan1_rx_bytes: (wanHealth?.['rx_bytes-r'] as number) || (wan1Data?.['rx_bytes-r'] as number) || 0,
        wan2_tx_bytes: (wan2Data?.['tx_bytes-r'] as number) || 0,
        wan2_rx_bytes: (wan2Data?.['rx_bytes-r'] as number) || 0,
      };

      logger.debug('unifi', 'Fetched WAN info', {
        wan_ip: wan.wan_ip,
        wan2_ip: wan.wan2_ip,
        wan1_status: wan.wan1_status,
        wan2_status: wan.wan2_status,
        gw_name: wan.gw_name,
        wan1_isp: wan.wan1_isp_name,
        wan2_isp: wan.wan2_isp_name
      });

      return { wan };
    } catch (error) {
      logger.warn('unifi', 'Failed to fetch WAN info', { error: String(error) });
      return {
        wan: {
          wan_ip: null,
          wan2_ip: null,
          wan1_status: 'error',
          wan2_status: 'error',
          gw_name: null,
          gw_mac: null,
          gw_version: null,
          wan1_isp_name: null,
          wan1_isp_organization: null,
          wan2_isp_name: null,
          wan2_isp_organization: null,
          wan1_netmask: null,
          wan2_netmask: null,
          wan1_uptime: null,
          wan2_uptime: null,
          wan1_tx_bytes: 0,
          wan1_rx_bytes: 0,
          wan2_tx_bytes: 0,
          wan2_rx_bytes: 0,
        }
      };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'clients',
        name: 'Connected Clients',
        description: 'List of all connected clients (wired and wireless)',
        widgetTypes: ['client-count', 'client-list'],
      },
      {
        id: 'devices',
        name: 'Network Devices',
        description: 'List of all UniFi network devices (APs, switches, gateways)',
        widgetTypes: ['device-list', 'active-devices'],
      },
      {
        id: 'health',
        name: 'System Health',
        description: 'Overall health status of network subsystems',
        widgetTypes: ['network-health'],
      },
      {
        id: 'networks',
        name: 'Network Configuration',
        description: 'Configured networks and VLANs',
        widgetTypes: ['network-list'],
      },
      {
        id: 'wlans',
        name: 'WiFi Networks',
        description: 'List of configured WiFi networks/SSIDs (requires username/password auth)',
        widgetTypes: ['wifi-networks'],
      },
      {
        id: 'dpi',
        name: 'DPI Statistics',
        description: 'Deep Packet Inspection traffic categories (requires username/password auth)',
        widgetTypes: ['dpi-stats'],
      },
      {
        id: 'events',
        name: 'Network Events',
        description: 'Recent network events and alerts (requires username/password auth)',
        widgetTypes: ['events-list'],
      },
      {
        id: 'speedtest',
        name: 'Speed Test',
        description: 'Latest speed test results (requires username/password auth)',
        widgetTypes: ['speed-test'],
      },
      {
        id: 'wan',
        name: 'WAN Info',
        description: 'WAN IP addresses, gateway, and ISP info',
        widgetTypes: ['wan-info'],
      },
      {
        id: 'switch-ports',
        name: 'Switch Ports',
        description: 'Port status for UniFi switches (up/down, speed, PoE)',
        widgetTypes: ['switch-ports'],
      },
      {
        id: 'topology',
        name: 'Network Topology',
        description: 'Switch interconnections and uplink/downlink relationships',
        widgetTypes: ['switch-ports', 'cross-switch-port-overlay'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Clients - Implemented
      {
        id: 'sta-list',
        name: 'List Clients',
        description: 'Get list of all connected clients (stations)',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/sta',
        implemented: true,
        category: 'Clients',
        documentationUrl: 'https://ubntwiki.com/products/software/unifi-controller/api',
      },
      {
        id: 'client-detail',
        name: 'Get Client Details',
        description: 'Get detailed information about a specific client',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/user/{mac}',
        implemented: false,
        category: 'Clients',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Client MAC address' },
        ],
      },
      {
        id: 'block-client',
        name: 'Block Client',
        description: 'Block a client from the network',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/stamgr',
        implemented: false,
        category: 'Clients',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Client MAC address' },
        ],
      },
      {
        id: 'unblock-client',
        name: 'Unblock Client',
        description: 'Unblock a previously blocked client',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/stamgr',
        implemented: false,
        category: 'Clients',
      },
      {
        id: 'reconnect-client',
        name: 'Reconnect Client',
        description: 'Force a client to reconnect',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/stamgr',
        implemented: false,
        category: 'Clients',
      },
      {
        id: 'authorize-guest',
        name: 'Authorize Guest',
        description: 'Authorize a guest client',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/stamgr',
        implemented: false,
        category: 'Clients',
      },

      // Devices - Implemented
      {
        id: 'device-list',
        name: 'List Devices',
        description: 'Get list of all UniFi devices (APs, switches, gateways)',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/device',
        implemented: true,
        category: 'Devices',
      },
      {
        id: 'device-detail',
        name: 'Get Device Details',
        description: 'Get detailed information about a specific device',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/device/{mac}',
        implemented: false,
        category: 'Devices',
      },
      {
        id: 'adopt-device',
        name: 'Adopt Device',
        description: 'Adopt a new UniFi device',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/devmgr',
        implemented: false,
        category: 'Devices',
      },
      {
        id: 'restart-device',
        name: 'Restart Device',
        description: 'Restart a UniFi device',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/devmgr',
        implemented: false,
        category: 'Devices',
      },
      {
        id: 'upgrade-device',
        name: 'Upgrade Device',
        description: 'Upgrade device firmware',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/devmgr',
        implemented: false,
        category: 'Devices',
      },
      {
        id: 'locate-device',
        name: 'Locate Device',
        description: 'Flash LEDs on a device for identification',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/devmgr',
        implemented: false,
        category: 'Devices',
      },
      {
        id: 'power-cycle-port',
        name: 'Power Cycle PoE Port',
        description: 'Power cycle a PoE port on a switch',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/devmgr',
        implemented: false,
        category: 'Devices',
      },

      // Health - Implemented
      {
        id: 'health',
        name: 'Get Health',
        description: 'Get overall health status of network subsystems',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/health',
        implemented: true,
        category: 'Health',
      },

      // Networks
      {
        id: 'network-list',
        name: 'List Networks',
        description: 'Get configured networks and VLANs',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/networkconf',
        implemented: true,
        category: 'Networks',
      },
      {
        id: 'network-create',
        name: 'Create Network',
        description: 'Create a new network/VLAN',
        method: 'POST',
        endpoint: '/api/s/{site}/rest/networkconf',
        implemented: false,
        category: 'Networks',
      },
      {
        id: 'network-update',
        name: 'Update Network',
        description: 'Update network configuration',
        method: 'PUT',
        endpoint: '/api/s/{site}/rest/networkconf/{id}',
        implemented: false,
        category: 'Networks',
      },
      {
        id: 'network-delete',
        name: 'Delete Network',
        description: 'Delete a network',
        method: 'DELETE',
        endpoint: '/api/s/{site}/rest/networkconf/{id}',
        implemented: false,
        category: 'Networks',
      },

      // WLANs - Implemented
      {
        id: 'wlan-list',
        name: 'List WLANs',
        description: 'Get configured WiFi networks/SSIDs',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/wlanconf',
        implemented: true,
        category: 'WiFi',
      },
      {
        id: 'wlan-create',
        name: 'Create WLAN',
        description: 'Create a new WiFi network',
        method: 'POST',
        endpoint: '/api/s/{site}/rest/wlanconf',
        implemented: false,
        category: 'WiFi',
      },
      {
        id: 'wlan-update',
        name: 'Update WLAN',
        description: 'Update WiFi network settings',
        method: 'PUT',
        endpoint: '/api/s/{site}/rest/wlanconf/{id}',
        implemented: false,
        category: 'WiFi',
      },
      {
        id: 'wlan-enable',
        name: 'Enable/Disable WLAN',
        description: 'Enable or disable a WiFi network',
        method: 'PUT',
        endpoint: '/api/s/{site}/rest/wlanconf/{id}',
        implemented: false,
        category: 'WiFi',
      },

      // DPI - Implemented
      {
        id: 'dpi-stats',
        name: 'Get DPI Stats',
        description: 'Get Deep Packet Inspection traffic statistics',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/dpi',
        implemented: true,
        category: 'Statistics',
      },
      {
        id: 'site-stats',
        name: 'Get Site Statistics',
        description: 'Get overall site statistics',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/sites',
        implemented: false,
        category: 'Statistics',
      },
      {
        id: 'hourly-stats',
        name: 'Get Hourly Stats',
        description: 'Get hourly site statistics',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/report/hourly.site',
        implemented: false,
        category: 'Statistics',
      },
      {
        id: 'daily-stats',
        name: 'Get Daily Stats',
        description: 'Get daily site statistics',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/report/daily.site',
        implemented: false,
        category: 'Statistics',
      },

      // Events - Implemented
      {
        id: 'events-list',
        name: 'List Events',
        description: 'Get recent network events and alerts',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/event',
        implemented: true,
        category: 'Events',
      },
      {
        id: 'alarms-list',
        name: 'List Alarms',
        description: 'Get active alarms',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/alarm',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'archive-alarm',
        name: 'Archive Alarm',
        description: 'Archive/acknowledge an alarm',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/evtmgr',
        implemented: false,
        category: 'Events',
      },

      // Speed Test - Implemented
      {
        id: 'speedtest-results',
        name: 'Get Speed Test Results',
        description: 'Get latest speed test results',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/speedtest',
        implemented: true,
        category: 'Speed Test',
      },
      {
        id: 'speedtest-run',
        name: 'Run Speed Test',
        description: 'Initiate a new speed test',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/speedtest',
        implemented: false,
        category: 'Speed Test',
      },

      // WAN - Implemented
      {
        id: 'wan-info',
        name: 'Get WAN Info',
        description: 'Get WAN IP addresses and gateway info',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/routing',
        implemented: true,
        category: 'WAN',
      },

      // Switch Ports - Implemented
      {
        id: 'port-profiles',
        name: 'List Port Profiles',
        description: 'Get switch port profiles',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/portconf',
        implemented: false,
        category: 'Switches',
      },
      {
        id: 'port-forward-list',
        name: 'List Port Forwards',
        description: 'Get configured port forwarding rules',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/portforward',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'port-forward-create',
        name: 'Create Port Forward',
        description: 'Create a new port forwarding rule',
        method: 'POST',
        endpoint: '/api/s/{site}/rest/portforward',
        implemented: false,
        category: 'Firewall',
      },

      // Firewall
      {
        id: 'firewall-rules',
        name: 'List Firewall Rules',
        description: 'Get firewall rules',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/firewallrule',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-groups',
        name: 'List Firewall Groups',
        description: 'Get firewall groups (IP groups, port groups)',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/firewallgroup',
        implemented: false,
        category: 'Firewall',
      },

      // Routing
      {
        id: 'static-routes',
        name: 'List Static Routes',
        description: 'Get configured static routes',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/routing',
        implemented: false,
        category: 'Routing',
      },

      // Site Management
      {
        id: 'sites-list',
        name: 'List Sites',
        description: 'Get all sites managed by controller',
        method: 'GET',
        endpoint: '/api/self/sites',
        implemented: false,
        category: 'Sites',
      },
      {
        id: 'site-settings',
        name: 'Get Site Settings',
        description: 'Get site configuration settings',
        method: 'GET',
        endpoint: '/api/s/{site}/rest/setting',
        implemented: false,
        category: 'Sites',
      },

      // System
      {
        id: 'sysinfo',
        name: 'Get System Info',
        description: 'Get controller system information',
        method: 'GET',
        endpoint: '/api/s/{site}/stat/sysinfo',
        implemented: false,
        category: 'System',
      },
      {
        id: 'backup-list',
        name: 'List Backups',
        description: 'Get available controller backups',
        method: 'GET',
        endpoint: '/api/s/{site}/cmd/backup',
        implemented: false,
        category: 'System',
      },
      {
        id: 'backup-create',
        name: 'Create Backup',
        description: 'Create a new controller backup',
        method: 'POST',
        endpoint: '/api/s/{site}/cmd/backup',
        implemented: false,
        category: 'System',
      },
    ];
  }
}
