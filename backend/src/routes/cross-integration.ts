/**
 * Cross-Integration Routes
 *
 * API endpoints that aggregate data from multiple integrations.
 */

import { Router, Request, Response } from 'express';
import { logger } from '../services/logger';
import {
  getEnabledIntegrationsByType,
  fetchIntegrationData,
  buildCrossIntegrationResponse,
  getFirstIntegration,
  getNumericValue,
  extractIpAddress,
  CrossIntegrationResponse,
} from '../integrations/cross-integration-helpers';

const router = Router();

// ============================================================================
// Media Pipeline Types
// ============================================================================

interface MediaPipelineStage {
  count: number;
  source: string | null;
  details?: Record<string, unknown>;
}

interface MediaPipelineData {
  stages: {
    requests: MediaPipelineStage & { pending: number };
    indexers: MediaPipelineStage & { healthy: number; total: number };
    tvQueue: MediaPipelineStage & { wanted: number };
    movieQueue: MediaPipelineStage & { wanted: number };
    downloads: MediaPipelineStage & { active: number; speed: number; speedUnit: string };
    transcoding: MediaPipelineStage & { queue: number; active: number };
    available: MediaPipelineStage & { movies: number; shows: number; episodes: number };
  };
  bottleneck: string | null;
  totalInPipeline: number;
}

// ============================================================================
// Subtitle Health Types
// ============================================================================

interface SubtitleHealthData {
  healthScore: number;
  totalMissing: {
    series: number;
    movies: number;
    total: number;
  };
  popularMissing: {
    title: string;
    type: 'series' | 'movie';
    missingCount: number;
    watchCount?: number;
  }[];
  recentlyWatched: {
    title: string;
    hasMissingSubtitles: boolean;
  }[];
}

// ============================================================================
// Download Activity Types
// ============================================================================

interface DownloadActivityData {
  downloading: {
    active: number;
    speed: number;
    speedUnit: string;
    sources: {
      name: string;
      type: 'sabnzbd' | 'qbittorrent';
      active: number;
      speed: number;
    }[];
  };
  streaming: {
    active: number;
    bandwidth: number;
    bandwidthUnit: string;
  };
  networkContention: boolean;
  contentionWarning: string | null;
}

// ============================================================================
// Transcoding Resources Types
// ============================================================================

interface TranscodingResourcesData {
  transcoding: {
    active: number;
    hwAccelerated: number;
    directPlay: number;
    directStream: number;
    source: string | null;
  };
  resources: {
    cpu: number;
    memory: number;
    source: string | null;
    serverName: string | null;
  };
  correlation: {
    cpuPerTranscode: number;
    isResourceBound: boolean;
  };
}

// ============================================================================
// Service Mapping Types
// ============================================================================

interface ServiceMappingData {
  services: {
    integrationId: string;
    integrationName: string;
    integrationType: string;
    host: string;
    vm: {
      vmid: number;
      name: string;
      type: 'qemu' | 'lxc';
      status: string;
      cpu: number;
      memory: number;
      node: string;
    } | null;
  }[];
  unmappedVms: {
    vmid: number;
    name: string;
    type: 'qemu' | 'lxc';
    status: string;
    node: string;
    ip?: string;
  }[];
}

// ============================================================================
// Client Correlation Types
// ============================================================================

interface ClientCorrelationData {
  sessions: {
    sessionId: string;
    user: string;
    title: string;
    mediaType: string;
    player: string;
    ipAddress: string;
    state: string;
    transcodeDecision: string;
    bandwidth: number;
    client: {
      name: string;
      mac: string;
      connectionType: 'wired' | 'wireless' | 'unknown';
      signalStrength?: number;
      network?: string;
      manufacturer?: string;
    } | null;
  }[];
  unmatchedClients: {
    ip: string;
    user: string;
  }[];
}

// ============================================================================
// Media Pipeline Endpoint
// ============================================================================

router.get('/media-pipeline', async (_req: Request, res: Response) => {
  try {
    const requiredTypes = ['overseerr', 'prowlarr', 'sonarr', 'radarr', 'sabnzbd', 'qbittorrent', 'tdarr', 'plex', 'tautulli'];
    const { byType } = getEnabledIntegrationsByType(requiredTypes);

    const data: MediaPipelineData = {
      stages: {
        requests: { count: 0, pending: 0, source: null },
        indexers: { count: 0, healthy: 0, total: 0, source: null },
        tvQueue: { count: 0, wanted: 0, source: null },
        movieQueue: { count: 0, wanted: 0, source: null },
        downloads: { count: 0, active: 0, speed: 0, speedUnit: 'MB/s', source: null },
        transcoding: { count: 0, queue: 0, active: 0, source: null },
        available: { count: 0, movies: 0, shows: 0, episodes: 0, source: null },
      },
      bottleneck: null,
      totalInPipeline: 0,
    };

    // Get all integrations for parallel fetching
    const overseerr = getFirstIntegration(byType, 'overseerr');
    const prowlarr = getFirstIntegration(byType, 'prowlarr');
    const sonarr = getFirstIntegration(byType, 'sonarr');
    const radarr = getFirstIntegration(byType, 'radarr');
    const sabnzbd = getFirstIntegration(byType, 'sabnzbd');
    const qbittorrent = getFirstIntegration(byType, 'qbittorrent');
    const tdarr = getFirstIntegration(byType, 'tdarr');
    const tautulli = getFirstIntegration(byType, 'tautulli');
    const plex = getFirstIntegration(byType, 'plex');

    // Fetch all integration data in parallel
    const [
      overseerrResult,
      prowlarrResult,
      sonarrQueueResult,
      sonarrWantedResult,
      radarrQueueResult,
      radarrWantedResult,
      sabnzbdResult,
      qbittorrentResult,
      tdarrResult,
      tautulliLibrariesResult,
      plexLibrariesResult,
    ] = await Promise.all([
      overseerr
        ? fetchIntegrationData<{ stats: { pending: number; approved: number; processing: number } }>(overseerr, 'request-stats')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      prowlarr
        ? fetchIntegrationData<{ indexers: Array<{ enable: boolean }> }>(prowlarr, 'indexers')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      sonarr
        ? fetchIntegrationData<{ queue: unknown[]; totalRecords: number }>(sonarr, 'queue')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      sonarr
        ? fetchIntegrationData<{ missing: unknown[]; totalRecords: number }>(sonarr, 'wanted')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      radarr
        ? fetchIntegrationData<{ queue: unknown[]; totalRecords: number }>(radarr, 'queue')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      radarr
        ? fetchIntegrationData<{ missing: unknown[]; totalRecords: number }>(radarr, 'wanted')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      sabnzbd
        ? fetchIntegrationData<{ queue: { noofslots: number; kbpersec: string; speed: string } }>(sabnzbd, 'queue')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      qbittorrent
        ? fetchIntegrationData<{ torrents: unknown[]; downloading: number; status: { downloadSpeed: number } }>(qbittorrent, 'torrents')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      tdarr
        ? fetchIntegrationData<{ queue: { transcodeQueue: number; healthCheckQueue: number }; workers: Array<{ type: string }> }>(tdarr, 'queue')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      tautulli
        ? fetchIntegrationData<{ libraries: Array<{ sectionType: string; count: number; childCount?: number }> }>(tautulli, 'libraries')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      plex && !tautulli // Only fetch from Plex if Tautulli is not available
        ? fetchIntegrationData<{ libraries: Array<{ type: string; count: number }> }>(plex, 'libraries')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
    ]);

    // Process Overseerr requests
    if (overseerrResult.success) {
      const stats = overseerrResult.data.stats;
      data.stages.requests = {
        count: (stats.pending || 0) + (stats.approved || 0) + (stats.processing || 0),
        pending: stats.pending || 0,
        source: 'overseerr',
      };
    }

    // Process Prowlarr indexer stats
    if (prowlarrResult.success) {
      const indexers = prowlarrResult.data.indexers || [];
      const healthy = indexers.filter(i => i.enable).length;
      data.stages.indexers = {
        count: indexers.length,
        healthy,
        total: indexers.length,
        source: 'prowlarr',
      };
    }

    // Process Sonarr queue
    if (sonarrQueueResult.success || sonarrWantedResult.success) {
      data.stages.tvQueue = {
        count: sonarrQueueResult.success ? sonarrQueueResult.data.totalRecords : 0,
        wanted: sonarrWantedResult.success ? sonarrWantedResult.data.totalRecords : 0,
        source: 'sonarr',
      };
    }

    // Process Radarr queue
    if (radarrQueueResult.success || radarrWantedResult.success) {
      data.stages.movieQueue = {
        count: radarrQueueResult.success ? radarrQueueResult.data.totalRecords : 0,
        wanted: radarrWantedResult.success ? radarrWantedResult.data.totalRecords : 0,
        source: 'radarr',
      };
    }

    // Process download clients
    let totalDownloadSpeed = 0;
    let totalDownloadActive = 0;
    const downloadSources: string[] = [];

    if (sabnzbdResult.success) {
      const queue = sabnzbdResult.data.queue;
      totalDownloadActive += queue.noofslots || 0;
      totalDownloadSpeed += parseFloat(queue.kbpersec || '0') / 1024; // Convert KB/s to MB/s
      downloadSources.push('sabnzbd');
    }

    if (qbittorrentResult.success) {
      totalDownloadActive += qbittorrentResult.data.downloading || 0;
      totalDownloadSpeed += (qbittorrentResult.data.status?.downloadSpeed || 0) / (1024 * 1024); // Convert B/s to MB/s
      downloadSources.push('qbittorrent');
    }

    if (downloadSources.length > 0) {
      data.stages.downloads = {
        count: totalDownloadActive,
        active: totalDownloadActive,
        speed: Math.round(totalDownloadSpeed * 10) / 10,
        speedUnit: 'MB/s',
        source: downloadSources.join('+'),
      };
    }

    // Process Tdarr transcoding
    if (tdarrResult.success) {
      const queue = tdarrResult.data.queue;
      const workers = tdarrResult.data.workers || [];
      const activeTranscodes = workers.filter(w => w.type === 'transcode').length;
      data.stages.transcoding = {
        count: (queue.transcodeQueue || 0) + activeTranscodes,
        queue: queue.transcodeQueue || 0,
        active: activeTranscodes,
        source: 'tdarr',
      };
    }

    // Process Plex/Tautulli library stats
    if (tautulliLibrariesResult.success) {
      const libraries = tautulliLibrariesResult.data.libraries || [];
      let movies = 0;
      let shows = 0;
      let episodes = 0;

      for (const lib of libraries) {
        if (lib.sectionType === 'movie') {
          movies += lib.count || 0;
        } else if (lib.sectionType === 'show') {
          shows += lib.count || 0;
          episodes += lib.childCount || 0;
        }
      }

      data.stages.available = {
        count: movies + shows,
        movies,
        shows,
        episodes,
        source: 'tautulli',
      };
    } else if (plexLibrariesResult.success) {
      const libraries = plexLibrariesResult.data.libraries || [];
      let movies = 0;
      let shows = 0;

      for (const lib of libraries) {
        if (lib.type === 'movie') {
          movies += lib.count || 0;
        } else if (lib.type === 'show') {
          shows += lib.count || 0;
        }
      }

      data.stages.available = {
        count: movies + shows,
        movies,
        shows,
        episodes: 0,
        source: 'plex',
      };
    }

    // Calculate pipeline total and bottleneck
    const pipelineCounts = [
      { stage: 'requests', count: data.stages.requests.count },
      { stage: 'tvQueue', count: data.stages.tvQueue.count },
      { stage: 'movieQueue', count: data.stages.movieQueue.count },
      { stage: 'downloads', count: data.stages.downloads.count },
      { stage: 'transcoding', count: data.stages.transcoding.count },
    ];

    data.totalInPipeline = pipelineCounts.reduce((sum, p) => sum + p.count, 0);

    const maxCount = Math.max(...pipelineCounts.map(p => p.count));
    if (maxCount > 0) {
      const bottleneckStage = pipelineCounts.find(p => p.count === maxCount);
      if (bottleneckStage && bottleneckStage.count > 3) {
        data.bottleneck = bottleneckStage.stage;
      }
    }

    const response = buildCrossIntegrationResponse(requiredTypes, byType, data);
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', 'Failed to fetch media pipeline data', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// ============================================================================
// Subtitle Health Endpoint
// ============================================================================

router.get('/subtitle-health', async (_req: Request, res: Response) => {
  try {
    const requiredTypes = ['bazarr', 'tautulli'];
    const { byType } = getEnabledIntegrationsByType(requiredTypes);

    const data: SubtitleHealthData = {
      healthScore: 100,
      totalMissing: { series: 0, movies: 0, total: 0 },
      popularMissing: [],
      recentlyWatched: [],
    };

    // Fetch Bazarr wanted (missing subtitles)
    const bazarr = getFirstIntegration(byType, 'bazarr');
    let missingSeriesTitles: Set<string> = new Set();
    let missingMovieTitles: Set<string> = new Set();

    if (bazarr) {
      const [wantedResult, seriesResult, moviesResult] = await Promise.all([
        fetchIntegrationData<{ wanted: { seriesMissing: number; moviesMissing: number } }>(bazarr, 'wanted'),
        fetchIntegrationData<{ series: Array<{ title: string; missingSubtitles: number }> }>(bazarr, 'series'),
        fetchIntegrationData<{ movies: Array<{ title: string; missingSubtitles: string[] }> }>(bazarr, 'movies'),
      ]);

      if (wantedResult.success) {
        data.totalMissing.series = wantedResult.data.wanted.seriesMissing || 0;
        data.totalMissing.movies = wantedResult.data.wanted.moviesMissing || 0;
        data.totalMissing.total = data.totalMissing.series + data.totalMissing.movies;
      }

      if (seriesResult.success) {
        for (const series of seriesResult.data.series || []) {
          if (series.missingSubtitles > 0) {
            missingSeriesTitles.add(series.title.toLowerCase());
            data.popularMissing.push({
              title: series.title,
              type: 'series',
              missingCount: series.missingSubtitles,
            });
          }
        }
      }

      if (moviesResult.success) {
        for (const movie of moviesResult.data.movies || []) {
          if (movie.missingSubtitles && movie.missingSubtitles.length > 0) {
            missingMovieTitles.add(movie.title.toLowerCase());
            data.popularMissing.push({
              title: movie.title,
              type: 'movie',
              missingCount: movie.missingSubtitles.length,
            });
          }
        }
      }
    }

    // Fetch Tautulli home stats for popular content
    const tautulli = getFirstIntegration(byType, 'tautulli');
    if (tautulli) {
      const result = await fetchIntegrationData<{
        homeStats: Array<{
          stat_id: string;
          rows: Array<{ title: string; total_plays: number }>;
        }>;
      }>(tautulli, 'home-stats');

      if (result.success) {
        const homeStats = result.data.homeStats || [];

        // Find popular movies stat
        const popularMovies = homeStats.find(s => s.stat_id === 'popular_movies');
        const popularShows = homeStats.find(s => s.stat_id === 'popular_tv');

        // Cross-reference with missing subtitles
        for (const item of popularMovies?.rows || []) {
          const titleLower = item.title.toLowerCase();
          const existingEntry = data.popularMissing.find(
            p => p.type === 'movie' && p.title.toLowerCase() === titleLower
          );
          if (existingEntry) {
            existingEntry.watchCount = item.total_plays;
          }

          data.recentlyWatched.push({
            title: item.title,
            hasMissingSubtitles: missingMovieTitles.has(titleLower),
          });
        }

        for (const item of popularShows?.rows || []) {
          const titleLower = item.title.toLowerCase();
          const existingEntry = data.popularMissing.find(
            p => p.type === 'series' && p.title.toLowerCase() === titleLower
          );
          if (existingEntry) {
            existingEntry.watchCount = item.total_plays;
          }

          data.recentlyWatched.push({
            title: item.title,
            hasMissingSubtitles: missingSeriesTitles.has(titleLower),
          });
        }
      }
    }

    // Sort popular missing by watch count (descending), then by missing count
    data.popularMissing.sort((a, b) => {
      if (a.watchCount && b.watchCount) {
        return b.watchCount - a.watchCount;
      }
      if (a.watchCount) return -1;
      if (b.watchCount) return 1;
      return b.missingCount - a.missingCount;
    });

    // Limit results
    data.popularMissing = data.popularMissing.slice(0, 10);
    data.recentlyWatched = data.recentlyWatched.slice(0, 10);

    // Calculate health score (higher is better)
    // Score based on total missing relative to an assumed reasonable threshold
    const threshold = 50; // Assume 50 missing is 0% healthy
    data.healthScore = Math.max(0, Math.min(100, Math.round(100 - (data.totalMissing.total / threshold) * 100)));

    const response = buildCrossIntegrationResponse(requiredTypes, byType, data);
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', 'Failed to fetch subtitle health data', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// ============================================================================
// Download Activity Endpoint
// ============================================================================

router.get('/download-activity', async (_req: Request, res: Response) => {
  try {
    const requiredTypes = ['sabnzbd', 'qbittorrent', 'tautulli'];
    const { byType } = getEnabledIntegrationsByType(requiredTypes);

    const data: DownloadActivityData = {
      downloading: {
        active: 0,
        speed: 0,
        speedUnit: 'MB/s',
        sources: [],
      },
      streaming: {
        active: 0,
        bandwidth: 0,
        bandwidthUnit: 'Mbps',
      },
      networkContention: false,
      contentionWarning: null,
    };

    // Get all integrations for parallel fetching
    const sabnzbd = getFirstIntegration(byType, 'sabnzbd');
    const qbittorrent = getFirstIntegration(byType, 'qbittorrent');
    const tautulli = getFirstIntegration(byType, 'tautulli');

    // Fetch all integration data in parallel
    const [sabnzbdResult, qbittorrentResult, tautulliResult] = await Promise.all([
      sabnzbd
        ? fetchIntegrationData<{ queue: { noofslots: number; kbpersec: string } }>(sabnzbd, 'queue')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      qbittorrent
        ? fetchIntegrationData<{ downloading: number; status: { downloadSpeed: number } }>(qbittorrent, 'torrents')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      tautulli
        ? fetchIntegrationData<{ activity: { streamCount: number; totalBandwidth: number } }>(tautulli, 'activity')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
    ]);

    // Process SABnzbd
    if (sabnzbdResult.success) {
      const speedMBps = parseFloat(sabnzbdResult.data.queue.kbpersec || '0') / 1024;
      data.downloading.sources.push({
        name: 'SABnzbd',
        type: 'sabnzbd',
        active: sabnzbdResult.data.queue.noofslots || 0,
        speed: Math.round(speedMBps * 10) / 10,
      });
      data.downloading.active += sabnzbdResult.data.queue.noofslots || 0;
      data.downloading.speed += speedMBps;
    }

    // Process qBittorrent
    if (qbittorrentResult.success) {
      const speedMBps = (qbittorrentResult.data.status?.downloadSpeed || 0) / (1024 * 1024);
      data.downloading.sources.push({
        name: 'qBittorrent',
        type: 'qbittorrent',
        active: qbittorrentResult.data.downloading || 0,
        speed: Math.round(speedMBps * 10) / 10,
      });
      data.downloading.active += qbittorrentResult.data.downloading || 0;
      data.downloading.speed += speedMBps;
    }

    data.downloading.speed = Math.round(data.downloading.speed * 10) / 10;

    // Process Tautulli streaming activity
    if (tautulliResult.success) {
      data.streaming.active = tautulliResult.data.activity.streamCount || 0;
      // Tautulli bandwidth is in kbps, convert to Mbps
      data.streaming.bandwidth = Math.round((tautulliResult.data.activity.totalBandwidth || 0) / 1000 * 10) / 10;
    }

    // Detect network contention
    // If download speed > 50 MB/s AND streaming > 20 Mbps, warn about potential contention
    const downloadMbps = data.downloading.speed * 8; // Convert MB/s to Mbps
    if (downloadMbps > 50 && data.streaming.bandwidth > 20) {
      data.networkContention = true;
      data.contentionWarning = 'High download activity may affect streaming quality';
    }

    const response = buildCrossIntegrationResponse(requiredTypes, byType, data);
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', 'Failed to fetch download activity data', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// ============================================================================
// Transcoding Resources Endpoint
// ============================================================================

router.get('/transcoding-resources', async (_req: Request, res: Response) => {
  try {
    const requiredTypes = ['tautulli', 'plex', 'proxmox', 'beszel'];
    const { byType } = getEnabledIntegrationsByType(requiredTypes);

    const data: TranscodingResourcesData = {
      transcoding: {
        active: 0,
        hwAccelerated: 0,
        directPlay: 0,
        directStream: 0,
        source: null,
      },
      resources: {
        cpu: 0,
        memory: 0,
        source: null,
        serverName: null,
      },
      correlation: {
        cpuPerTranscode: 0,
        isResourceBound: false,
      },
    };

    // Get all integrations for parallel fetching
    const tautulli = getFirstIntegration(byType, 'tautulli');
    const proxmox = getFirstIntegration(byType, 'proxmox');
    const beszel = getFirstIntegration(byType, 'beszel');

    // Fetch all integration data in parallel
    const [tautulliResult, proxmoxResult, beszelResult] = await Promise.all([
      tautulli
        ? fetchIntegrationData<{
            activity: {
              streamCount: number;
              streamCountDirectPlay: number;
              streamCountDirectStream: number;
              streamCountTranscode: number;
              sessions: Array<{
                transcodeDecision: string;
                transcodeHwFullPipeline: boolean;
              }>;
            };
          }>(tautulli, 'activity')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      proxmox
        ? fetchIntegrationData<{
            nodes: Array<{ node: string; cpu: number; mem: number; maxmem: number; status: string }>;
          }>(proxmox, 'nodes')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      beszel && !proxmox // Only fetch from Beszel if Proxmox is not available
        ? fetchIntegrationData<{
            systems: Array<{ name: string; cpu: number; mem: number; status: string }>;
          }>(beszel, 'systems')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
    ]);

    // Process Tautulli activity for transcoding info
    if (tautulliResult.success) {
      const activity = tautulliResult.data.activity;
      const hwAccelerated = activity.sessions?.filter(s =>
        s.transcodeDecision === 'transcode' && s.transcodeHwFullPipeline
      ).length || 0;

      data.transcoding = {
        active: activity.streamCountTranscode || 0,
        hwAccelerated,
        directPlay: activity.streamCountDirectPlay || 0,
        directStream: activity.streamCountDirectStream || 0,
        source: 'tautulli',
      };
    }

    // Process Proxmox or Beszel for CPU/memory
    if (proxmoxResult.success && proxmoxResult.data.nodes?.length > 0) {
      // Use the first running node as the server
      const runningNode = proxmoxResult.data.nodes.find(n => n.status === 'online') || proxmoxResult.data.nodes[0];
      data.resources = {
        cpu: Math.round((runningNode.cpu || 0) * 100),
        memory: Math.round(((runningNode.mem || 0) / (runningNode.maxmem || 1)) * 100),
        source: 'proxmox',
        serverName: runningNode.node,
      };
    } else if (beszelResult.success && beszelResult.data.systems?.length > 0) {
      const activeSystem = beszelResult.data.systems.find(s => s.status === 'up') || beszelResult.data.systems[0];
      data.resources = {
        cpu: Math.round(activeSystem.cpu || 0),
        memory: Math.round(activeSystem.mem || 0),
        source: 'beszel',
        serverName: activeSystem.name,
      };
    }

    // Calculate correlation
    if (data.transcoding.active > 0 && data.resources.cpu > 0) {
      data.correlation.cpuPerTranscode = Math.round(data.resources.cpu / data.transcoding.active);
      // If CPU is > 80% and there are transcodes, consider it resource bound
      data.correlation.isResourceBound = data.resources.cpu > 80;
    }

    const response = buildCrossIntegrationResponse(requiredTypes, byType, data);
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', 'Failed to fetch transcoding resources data', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// ============================================================================
// Service Mapping Endpoint
// ============================================================================

router.get('/service-mapping', async (_req: Request, res: Response) => {
  try {
    const infraTypes = ['proxmox'];
    const serviceTypes = [
      'plex', 'tautulli', 'sonarr', 'radarr', 'bazarr', 'overseerr',
      'prowlarr', 'sabnzbd', 'qbittorrent', 'tdarr', 'adguard',
      'unifi', 'beszel', 'homeassistant', 'homebridge', 'immich',
    ];

    const { byType: infraByType } = getEnabledIntegrationsByType(infraTypes);
    const { integrations: serviceIntegrations } = getEnabledIntegrationsByType(serviceTypes);

    const data: ServiceMappingData = {
      services: [],
      unmappedVms: [],
    };

    // Get Proxmox VMs and containers
    const proxmox = getFirstIntegration(infraByType, 'proxmox');
    let vmList: Array<{
      vmid: number;
      name: string;
      type: 'qemu' | 'lxc';
      status: string;
      cpu: number;
      memory: number;
      node: string;
      ip?: string;
    }> = [];

    if (proxmox) {
      const [vmsResult, containersResult] = await Promise.all([
        fetchIntegrationData<{ vms: Array<{ vmid: number; name: string; status: string; cpu: number; mem: number; maxmem: number; node: string }> }>(proxmox, 'vms'),
        fetchIntegrationData<{ containers: Array<{ vmid: number; name: string; status: string; cpu: number; mem: number; maxmem: number; node: string }> }>(proxmox, 'containers'),
      ]);

      if (vmsResult.success) {
        for (const vm of vmsResult.data.vms || []) {
          vmList.push({
            vmid: vm.vmid,
            name: vm.name,
            type: 'qemu',
            status: vm.status,
            cpu: Math.round((vm.cpu || 0) * 100),
            memory: Math.round(((vm.mem || 0) / (vm.maxmem || 1)) * 100),
            node: vm.node,
          });
        }
      }

      if (containersResult.success) {
        for (const ct of containersResult.data.containers || []) {
          vmList.push({
            vmid: ct.vmid,
            name: ct.name,
            type: 'lxc',
            status: ct.status,
            cpu: Math.round((ct.cpu || 0) * 100),
            memory: Math.round(((ct.mem || 0) / (ct.maxmem || 1)) * 100),
            node: ct.node,
          });
        }
      }
    }

    // Build VM name and IP lookup
    const vmByName = new Map(vmList.map(vm => [vm.name.toLowerCase(), vm]));
    const matchedVmIds = new Set<number>();

    // Match services to VMs
    for (const service of serviceIntegrations) {
      const config = JSON.parse(service.config);
      const host = extractIpAddress(config.host || '');

      // Try to match by name first (common pattern: service name matches VM name)
      const serviceNameParts = service.name.toLowerCase().split(/[\s-_]+/);
      let matchedVm = null;

      // Direct name match
      for (const [vmName, vm] of vmByName) {
        if (vmName.includes(service.type) || serviceNameParts.some(part => vmName.includes(part))) {
          matchedVm = vm;
          break;
        }
      }

      if (matchedVm) {
        matchedVmIds.add(matchedVm.vmid);
      }

      data.services.push({
        integrationId: service.id,
        integrationName: service.name,
        integrationType: service.type,
        host,
        vm: matchedVm ? {
          vmid: matchedVm.vmid,
          name: matchedVm.name,
          type: matchedVm.type,
          status: matchedVm.status,
          cpu: matchedVm.cpu,
          memory: matchedVm.memory,
          node: matchedVm.node,
        } : null,
      });
    }

    // Add unmapped VMs
    for (const vm of vmList) {
      if (!matchedVmIds.has(vm.vmid)) {
        data.unmappedVms.push({
          vmid: vm.vmid,
          name: vm.name,
          type: vm.type,
          status: vm.status,
          node: vm.node,
        });
      }
    }

    const response = buildCrossIntegrationResponse([...infraTypes, ...serviceTypes], { ...infraByType }, data);
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', 'Failed to fetch service mapping data', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// ============================================================================
// Client Correlation Endpoint
// ============================================================================

router.get('/client-correlation', async (_req: Request, res: Response) => {
  try {
    const requiredTypes = ['unifi', 'tautulli', 'plex'];
    const { byType } = getEnabledIntegrationsByType(requiredTypes);

    const data: ClientCorrelationData = {
      sessions: [],
      unmatchedClients: [],
    };

    // Get all integrations for parallel fetching
    const unifi = getFirstIntegration(byType, 'unifi');
    const tautulli = getFirstIntegration(byType, 'tautulli');

    // Fetch all integration data in parallel
    const [unifiResult, tautulliResult] = await Promise.all([
      unifi
        ? fetchIntegrationData<{
            clients: Array<{
              ip: string;
              name?: string;
              hostname?: string;
              mac: string;
              is_wired: boolean;
              signal?: number;
              network?: string;
              oui?: string;
            }>;
          }>(unifi, 'clients')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
      tautulli
        ? fetchIntegrationData<{
            activity: {
              sessions: Array<{
                sessionId: string;
                user: string;
                friendlyName: string;
                title: string;
                grandparentTitle?: string;
                mediaType: string;
                player: string;
                ipAddress: string;
                state: string;
                transcodeDecision: string;
                bandwidth: number;
              }>;
            };
          }>(tautulli, 'activity')
        : Promise.resolve({ success: false as const, error: 'Not configured' }),
    ]);

    // Build UniFi clients lookup map
    let clientsByIp = new Map<string, {
      name: string;
      mac: string;
      connectionType: 'wired' | 'wireless' | 'unknown';
      signalStrength?: number;
      network?: string;
      manufacturer?: string;
    }>();

    if (unifiResult.success) {
      for (const client of unifiResult.data.clients || []) {
        if (client.ip) {
          clientsByIp.set(client.ip, {
            name: client.name || client.hostname || 'Unknown',
            mac: client.mac,
            connectionType: client.is_wired ? 'wired' : 'wireless',
            signalStrength: client.signal,
            network: client.network,
            manufacturer: client.oui,
          });
        }
      }
    }

    // Process Tautulli activity
    if (tautulliResult.success) {
      const unmatchedIps = new Set<string>();

      for (const session of tautulliResult.data.activity.sessions || []) {
        const client = clientsByIp.get(session.ipAddress);

        const displayTitle = session.grandparentTitle
          ? `${session.grandparentTitle} - ${session.title}`
          : session.title;

        data.sessions.push({
          sessionId: session.sessionId,
          user: session.friendlyName || session.user,
          title: displayTitle,
          mediaType: session.mediaType,
          player: session.player,
          ipAddress: session.ipAddress,
          state: session.state,
          transcodeDecision: session.transcodeDecision,
          bandwidth: session.bandwidth,
          client: client || null,
        });

        if (!client && session.ipAddress) {
          unmatchedIps.add(session.ipAddress);
        }
      }

      // Report unmatched IPs
      for (const ip of unmatchedIps) {
        const session = data.sessions.find(s => s.ipAddress === ip);
        if (session) {
          data.unmatchedClients.push({
            ip,
            user: session.user,
          });
        }
      }
    }

    const response = buildCrossIntegrationResponse(requiredTypes, byType, data);
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', 'Failed to fetch client correlation data', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// ============================================================================
// TP-Link Device Discovery Endpoint
// ============================================================================

// TP-Link MAC address OUI prefixes (first 3 bytes) - comprehensive list
const TPLINK_MAC_PREFIXES = [
  // Common TP-Link prefixes
  '50:C7:BF', '60:32:B1', 'B0:BE:76', 'C0:25:E9', 'F0:A7:31',
  '14:EB:B6', '54:AF:97', '5C:A6:E6', '68:FF:7B', '78:8C:B5',
  '88:36:6C', '98:DA:C4', 'B4:B0:24', 'C4:E9:84', 'D8:0D:17',
  'EC:08:6B', '1C:61:B4', 'AC:15:A2', 'E8:DE:27', '30:DE:4B',
  'A8:42:A1', 'B0:4E:26', '6C:5A:B0', '5C:E9:31', 'E4:FA:C4',
  // Additional TP-Link prefixes
  '00:31:92', '10:FE:ED', '14:CC:20', '14:CF:92', '18:A6:F7',
  '1C:3B:F3', '20:DC:E6', '24:69:68', '30:B5:C2', '34:60:F9',
  '34:E8:94', '38:3B:C8', '40:ED:00', '44:32:C8', '48:22:54',
  '4C:BC:A5', '50:3E:AA', '54:C8:0F', '58:D9:D5', '5C:63:BF',
  '60:A4:B7', '60:E3:27', '64:56:01', '64:66:B3', '64:70:02',
  '6C:B0:CE', '70:4F:57', '74:DA:88', '78:44:76', '7C:8B:CA',
  '80:8F:1D', '84:16:F9', '88:1F:A1', '8C:A6:DF', '90:F6:52',
  '94:D9:B3', '98:25:4A', '9C:21:6A', 'A0:F3:C1', 'A4:2B:B0',
  'A8:57:4E', 'AC:84:C6', 'B0:95:75', 'B4:2E:99', 'B8:D5:26',
  'BC:46:99', 'C0:06:C3', 'C4:6E:1F', 'C8:3A:35', 'CC:32:E5',
  'D0:37:45', 'D4:6E:0E', 'D8:47:32', 'DC:FE:18', 'E0:05:C5',
  'E4:C3:2A', 'E8:94:F6', 'EC:17:2F', 'F0:03:8C', 'F4:EC:38',
  'F8:1A:67', 'F8:D1:11', 'FC:EC:DA',
];

// Kasa model identifiers (older TP-Link smart home line)
// KP, KL, HS, EP, KB, KS, KC, KD prefixes indicate Kasa devices
// Check these BEFORE Tapo patterns since KP125M contains "P125" which could match Tapo
const KASA_MODEL_PATTERNS = [
  // Smart Plugs - HS series
  'HS100', 'HS103', 'HS105', 'HS107', 'HS110', 'HS200', 'HS210', 'HS220', 'HS300',
  // Smart Plugs - KP series (includes KP125M which could be misidentified)
  'KP100', 'KP105', 'KP115', 'KP125', 'KP125M', 'KP200', 'KP303', 'KP400', 'KP401', 'KP405',
  // Smart Plugs - EP series
  'EP10', 'EP25', 'EP40',
  // Smart Bulbs - KL series
  'KL50', 'KL60', 'KL110', 'KL120', 'KL125', 'KL130', 'KL135', 'KL400', 'KL420', 'KL430',
  // Smart Bulbs - KB series
  'KB100', 'KB130',
  // Smart Switches - KS series
  'KS200', 'KS220', 'KS230',
  // Cameras - KC series
  'KC100', 'KC105', 'KC110', 'KC115', 'KC120', 'KC200', 'KC300', 'KC310', 'KC400', 'KC410',
  // Doorbells - KD series
  'KD110',
  'KASA', // Generic Kasa mention
];

// Tapo model identifiers (newer TP-Link smart home line)
// Note: Tapo plugs use P prefix (P100, P110, etc.) - but NOT KP prefix (that's Kasa)
const TAPO_MODEL_PATTERNS = [
  // Smart Plugs - standalone P prefix only (NOT KP)
  'TAPO P100', 'TAPO P105', 'TAPO P110', 'TAPO P115', 'TAPO P125',
  // Power Strips
  'P300', 'P304', 'P306',
  // Smart Bulbs - L series
  'L510', 'L520', 'L530', 'L535', 'L610', 'L630', 'L900', 'L920', 'L930',
  // Hubs
  'H100', 'H200',
  // Sensors - T series
  'T100', 'T110', 'T300', 'T310', 'T315',
  // Switches - S series
  'S200', 'S210', 'S220',
  // Dimmers
  'D130',
  // Cameras - C series
  'C100', 'C110', 'C120', 'C200', 'C210', 'C220', 'C310', 'C320', 'C420', 'C520',
  'TAPO', // Generic Tapo mention
];

// Tapo Hub model identifiers
const TAPO_HUB_PATTERNS = ['H100', 'H200'];

interface DiscoveredTPLinkDevice {
  ip: string;
  mac: string;
  hostname: string | null;
  name: string | null;
  type: 'kasa' | 'tapo' | 'tapo-hub' | 'unknown';
  model: string | null;
  connectionType: 'wired' | 'wireless';
}

interface DiscoverTPLinkResponse {
  hasUnifi: boolean;
  kasaDevices: DiscoveredTPLinkDevice[];
  tapoDevices: DiscoveredTPLinkDevice[];
  tapoHubs: DiscoveredTPLinkDevice[];
  unknownDevices: DiscoveredTPLinkDevice[];
  totalFound: number;
}

function isTPLinkMac(mac: string): boolean {
  const macUpper = mac.toUpperCase().replace(/-/g, ':');
  const prefix = macUpper.substring(0, 8);
  return TPLINK_MAC_PREFIXES.some(p => p.toUpperCase() === prefix);
}

function detectTPLinkDeviceType(hostname: string | null, name: string | null): { type: 'kasa' | 'tapo' | 'tapo-hub' | 'unknown'; model: string | null } {
  const searchStrings = [
    hostname?.toUpperCase() || '',
    name?.toUpperCase() || '',
  ].join(' ');

  // Check for Kasa devices FIRST - Kasa uses KP, KL, HS, EP, KB, KS, KC, KD prefixes
  // Important: KP125M contains "P125" which could match Tapo, but KP prefix means Kasa
  for (const pattern of KASA_MODEL_PATTERNS) {
    if (searchStrings.includes(pattern.toUpperCase())) {
      // Extract full model number if possible (e.g., KP125M from "KP125M")
      const modelMatch = searchStrings.match(new RegExp(`(${pattern}[A-Z0-9]*)`, 'i'));
      return { type: 'kasa', model: modelMatch ? modelMatch[1] : pattern };
    }
  }

  // Check for Tapo Hubs
  for (const pattern of TAPO_HUB_PATTERNS) {
    // Make sure it's not a Kasa device that happens to have H100/H200 in name
    if (searchStrings.includes(pattern) && !searchStrings.match(/^K[A-Z]/)) {
      return { type: 'tapo-hub', model: pattern };
    }
  }

  // Check for Tapo devices - but only if it's not already identified as Kasa
  for (const pattern of TAPO_MODEL_PATTERNS) {
    if (searchStrings.includes(pattern.toUpperCase())) {
      const modelMatch = searchStrings.match(new RegExp(`(${pattern}[A-Z0-9]*)`, 'i'));
      return { type: 'tapo', model: modelMatch ? modelMatch[1] : pattern };
    }
  }

  // Check for generic mentions
  if (searchStrings.includes('TAPO')) {
    return { type: 'tapo', model: null };
  }
  if (searchStrings.includes('KASA')) {
    return { type: 'kasa', model: null };
  }

  return { type: 'unknown', model: null };
}

router.get('/discover-tplink', async (_req: Request, res: Response) => {
  try {
    const requiredTypes = ['unifi'];
    const { byType } = getEnabledIntegrationsByType(requiredTypes);

    const response: DiscoverTPLinkResponse = {
      hasUnifi: false,
      kasaDevices: [],
      tapoDevices: [],
      tapoHubs: [],
      unknownDevices: [],
      totalFound: 0,
    };

    const unifi = getFirstIntegration(byType, 'unifi');
    if (!unifi) {
      logger.debug('cross-integration', 'No UniFi integration configured for TP-Link discovery');
      res.json(response);
      return;
    }

    response.hasUnifi = true;

    const result = await fetchIntegrationData<{
      clients: Array<{
        ip: string;
        mac: string;
        hostname?: string;
        name?: string;
        is_wired: boolean;
      }>;
    }>(unifi, 'clients');

    if (!result.success) {
      logger.warn('cross-integration', 'Failed to fetch UniFi clients for TP-Link discovery', { error: result.error });
      res.json(response);
      return;
    }

    const clients = result.data.clients || [];
    logger.debug('cross-integration', `Scanning ${clients.length} UniFi clients for TP-Link devices`);

    for (const client of clients) {
      if (!client.mac || !client.ip) continue;

      // Check if device is TP-Link by MAC address OR by hostname/name pattern
      const hasTPLinkMac = isTPLinkMac(client.mac);
      const { type, model } = detectTPLinkDeviceType(client.hostname || null, client.name || null);

      // Include device if it has a TP-Link MAC OR if hostname/name indicates a Kasa/Tapo device
      const isTPLinkDevice = hasTPLinkMac || type !== 'unknown';

      if (isTPLinkDevice) {
        const device: DiscoveredTPLinkDevice = {
          ip: client.ip,
          mac: client.mac.toUpperCase(),
          hostname: client.hostname || null,
          name: client.name || null,
          type,
          model,
          connectionType: client.is_wired ? 'wired' : 'wireless',
        };

        switch (type) {
          case 'kasa':
            response.kasaDevices.push(device);
            break;
          case 'tapo':
            response.tapoDevices.push(device);
            break;
          case 'tapo-hub':
            response.tapoHubs.push(device);
            break;
          default:
            // Only add to unknown if it was detected by MAC (not by hostname pattern)
            // This ensures devices with TP-Link MACs but unrecognized hostnames are still found
            if (hasTPLinkMac) {
              response.unknownDevices.push(device);
            }
        }

        response.totalFound++;
      }
    }

    logger.info('cross-integration', `TP-Link discovery found ${response.totalFound} devices`, {
      kasa: response.kasaDevices.length,
      tapo: response.tapoDevices.length,
      tapoHubs: response.tapoHubs.length,
      unknown: response.unknownDevices.length,
    });

    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', 'Failed to discover TP-Link devices', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
