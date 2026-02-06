import axios from 'axios';
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import { IntegrationData, StorjConfig } from '../types';

export class StorjIntegration extends BaseIntegration {
  readonly type = 'storj';
  readonly name = 'Storj';

  private createS3Client(config: StorjConfig): S3Client {
    return new S3Client({
      region: 'us-east-1', // Required but ignored by Storj
      endpoint: config.endpoint || 'https://gateway.storjshare.io',
      credentials: {
        accessKeyId: config.accessKeyId || '',
        secretAccessKey: config.secretAccessKey || '',
      },
      forcePathStyle: true, // Required for Storj
    });
  }

  private getNodeBaseUrl(config: StorjConfig): string {
    const port = config.nodePort || 14002;
    return `http://${config.nodeHost}:${port}`;
  }

  async testConnection(config: StorjConfig): Promise<ConnectionTestResult> {
    try {
      if (config.mode === 'node' && config.nodeHost) {
        // Test Node API connection
        const baseUrl = this.getNodeBaseUrl(config);
        const response = await axios.get(`${baseUrl}/api/sno`, { timeout: 10000 });
        const data = response.data;

        return {
          success: true,
          message: `Connected to storage node v${data.version}`,
          details: {
            nodeId: data.nodeID?.substring(0, 16) + '...',
            version: data.version,
            upToDate: data.upToDate,
          },
        };
      } else {
        // Test S3 API connection
        const client = this.createS3Client(config);
        const command = new ListBucketsCommand({});
        const response = await client.send(command);

        return {
          success: true,
          message: `Connected to Storj S3. Found ${response.Buckets?.length || 0} buckets.`,
          details: {
            bucketCount: response.Buckets?.length || 0,
          },
        };
      }
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status?: number; data?: unknown };
        code?: string;
      };

      if (err.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Connection refused. Check host and port.',
        };
      }

      return {
        success: false,
        message: `Connection failed: ${err.message}`,
      };
    }
  }

  async getData(config: StorjConfig, metric: string): Promise<IntegrationData> {
    switch (metric) {
      case 'storage':
        return this.getStorage(config);
      case 'files':
        return this.getFiles(config);
      case 'node-status':
        return this.getNodeStatus(config);
      case 'satellites':
        return this.getSatellites(config);
      case 'earnings':
        return this.getEarnings(config);
      case 'bandwidth':
        return this.getBandwidth(config);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStorage(config: StorjConfig): Promise<IntegrationData> {
    const client = this.createS3Client(config);
    const listCommand = new ListBucketsCommand({});
    const response = await client.send(listCommand);

    const buckets = response.Buckets || [];
    let totalSize = 0;
    let totalObjects = 0;

    // Get object count and size for each bucket
    const bucketDetails = await Promise.all(
      buckets.slice(0, 10).map(async (bucket) => {
        try {
          const objectsCommand = new ListObjectsV2Command({
            Bucket: bucket.Name,
            MaxKeys: 1000,
          });
          const objectsResponse = await client.send(objectsCommand);
          const contents = objectsResponse.Contents || [];

          const bucketSize = contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
          const objectCount = objectsResponse.KeyCount || contents.length;

          totalSize += bucketSize;
          totalObjects += objectCount;

          return {
            name: bucket.Name || '',
            creationDate: bucket.CreationDate?.toISOString() || '',
            objectCount,
            totalSize: bucketSize,
          };
        } catch {
          return {
            name: bucket.Name || '',
            creationDate: bucket.CreationDate?.toISOString() || '',
            objectCount: 0,
            totalSize: 0,
          };
        }
      })
    );

    return {
      buckets: bucketDetails,
      totalStorage: totalSize,
      totalObjects,
      stats: {
        bucketCount: buckets.length,
        totalSize,
        totalObjects,
      },
    };
  }

  private async getFiles(config: StorjConfig): Promise<IntegrationData> {
    const client = this.createS3Client(config);
    const bucket = config.bucket || '';

    if (!bucket) {
      // If no bucket specified, get files from first bucket
      const listCommand = new ListBucketsCommand({});
      const bucketsResponse = await client.send(listCommand);
      const firstBucket = bucketsResponse.Buckets?.[0];

      if (!firstBucket?.Name) {
        return { files: [], bucket: '' };
      }

      config.bucket = firstBucket.Name;
    }

    const objectsCommand = new ListObjectsV2Command({
      Bucket: config.bucket,
      MaxKeys: 50,
    });
    const response = await client.send(objectsCommand);

    const files = (response.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || '',
      etag: obj.ETag || '',
      storageClass: obj.StorageClass || 'STANDARD',
    }));

    // Sort by last modified descending
    files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return {
      files,
      bucket: config.bucket,
    };
  }

  private async getNodeStatus(config: StorjConfig): Promise<IntegrationData> {
    const baseUrl = this.getNodeBaseUrl(config);
    const response = await axios.get(`${baseUrl}/api/sno`);
    const data = response.data;

    const diskUsed = data.diskSpace?.used || 0;
    const diskAvailable = data.diskSpace?.available || 0;
    const diskTotal = diskUsed + diskAvailable;

    return {
      nodeId: data.nodeID,
      version: data.version,
      upToDate: data.upToDate,
      allowedVersion: data.allowedVersion,
      wallet: data.wallet,
      lastPinged: data.lastPinged,
      startedAt: data.startedAt,
      diskSpace: {
        used: diskUsed,
        available: diskAvailable,
        trash: data.diskSpace?.trash || 0,
        overused: data.diskSpace?.overused || 0,
        percentUsed: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
      },
      bandwidth: {
        used: data.bandwidth?.used || 0,
        available: data.bandwidth?.available || 0,
      },
      satelliteCount: data.satellites?.length || 0,
    };
  }

  private async getSatellites(config: StorjConfig): Promise<IntegrationData> {
    const baseUrl = this.getNodeBaseUrl(config);

    // Get node overview first
    const overviewResponse = await axios.get(`${baseUrl}/api/sno`);
    const satellites = overviewResponse.data.satellites || [];

    // Get detailed info for each satellite
    const satelliteDetails = await Promise.all(
      satellites.map(async (sat: { id: string; url: string; disqualified?: string; suspended?: string }) => {
        try {
          const detailResponse = await axios.get(`${baseUrl}/api/sno/satellite/${sat.id}`);
          const detail = detailResponse.data;

          return {
            id: sat.id,
            name: this.getSatelliteName(sat.url),
            url: sat.url,
            disqualified: sat.disqualified,
            suspended: sat.suspended,
            storageUsed: detail.currentStorageUsed || 0,
            auditScore: detail.audit?.score || 0,
            uptimeScore: detail.uptime?.score || 0,
            egress: detail.egressSummary || 0,
            ingress: detail.ingressSummary || 0,
          };
        } catch {
          return {
            id: sat.id,
            name: this.getSatelliteName(sat.url),
            url: sat.url,
            disqualified: sat.disqualified,
            suspended: sat.suspended,
            storageUsed: 0,
            auditScore: 0,
            uptimeScore: 0,
            egress: 0,
            ingress: 0,
          };
        }
      })
    );

    // Calculate summary
    const totalStorage = satelliteDetails.reduce((sum, s) => sum + s.storageUsed, 0);
    const totalBandwidth = satelliteDetails.reduce((sum, s) => sum + s.egress + s.ingress, 0);
    const avgAuditScore =
      satelliteDetails.length > 0
        ? satelliteDetails.reduce((sum, s) => sum + s.auditScore, 0) / satelliteDetails.length
        : 0;
    const avgUptimeScore =
      satelliteDetails.length > 0
        ? satelliteDetails.reduce((sum, s) => sum + s.uptimeScore, 0) / satelliteDetails.length
        : 0;

    return {
      satellites: satelliteDetails,
      summary: {
        totalStorage,
        totalBandwidth,
        avgAuditScore: Math.round(avgAuditScore * 100) / 100,
        avgUptimeScore: Math.round(avgUptimeScore * 100) / 100,
      },
    };
  }

  private async getEarnings(config: StorjConfig): Promise<IntegrationData> {
    const baseUrl = this.getNodeBaseUrl(config);

    // Get estimated payout
    const payoutResponse = await axios.get(`${baseUrl}/api/sno/estimated-payout`);
    const payout = payoutResponse.data;

    // Get satellite details for earnings breakdown
    const overviewResponse = await axios.get(`${baseUrl}/api/sno`);
    const satellites = overviewResponse.data.satellites || [];

    let totalStorage = 0;
    let totalEgress = 0;
    let totalRepair = 0;
    let totalAudit = 0;

    for (const sat of satellites) {
      try {
        const detailResponse = await axios.get(`${baseUrl}/api/sno/satellite/${sat.id}`);
        const detail = detailResponse.data;
        totalStorage += detail.storageSummary || 0;
        totalEgress += detail.egressSummary || 0;
      } catch {
        // Skip failed satellites
      }
    }

    return {
      currentMonth: {
        storage: payout?.currentMonth?.egressBandwidth || 0,
        egress: payout?.currentMonth?.egressBandwidth || 0,
        repair: payout?.currentMonth?.egressRepairAudit || 0,
        audit: payout?.currentMonth?.diskSpace || 0,
        total: payout?.currentMonth?.payout || 0,
      },
      payout: {
        held: payout?.currentMonth?.held || 0,
        paid: payout?.previousMonth?.payout || 0,
        disposed: payout?.currentMonth?.disposed || 0,
      },
      history: [], // Would need additional API calls to get history
    };
  }

  private async getBandwidth(config: StorjConfig): Promise<IntegrationData> {
    const baseUrl = this.getNodeBaseUrl(config);

    const overviewResponse = await axios.get(`${baseUrl}/api/sno`);
    const satellites = overviewResponse.data.satellites || [];

    let totalEgress = 0;
    let totalIngress = 0;
    const bySatellite: Record<string, { egress: number; ingress: number }> = {};

    for (const sat of satellites) {
      try {
        const detailResponse = await axios.get(`${baseUrl}/api/sno/satellite/${sat.id}`);
        const detail = detailResponse.data;

        const egress = detail.egressSummary || 0;
        const ingress = detail.ingressSummary || 0;

        totalEgress += egress;
        totalIngress += ingress;

        bySatellite[this.getSatelliteName(sat.url)] = { egress, ingress };
      } catch {
        // Skip failed satellites
      }
    }

    return {
      summary: {
        egress: totalEgress,
        ingress: totalIngress,
        total: totalEgress + totalIngress,
      },
      daily: [], // Would need to parse bandwidthDailyHistory from satellite details
      bySatellite,
    };
  }

  private getSatelliteName(url: string): string {
    if (url.includes('us1')) return 'US1';
    if (url.includes('us2')) return 'US2';
    if (url.includes('eu1')) return 'EU1';
    if (url.includes('ap1')) return 'AP1';
    if (url.includes('saltlake')) return 'Salt Lake';
    return url.split(':')[0].split('.')[0];
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'storage',
        name: 'Storage Overview',
        description: 'Buckets and total storage usage (S3 mode)',
        widgetTypes: ['storj-storage'],
      },
      {
        id: 'files',
        name: 'Files',
        description: 'Files in a bucket (S3 mode)',
        widgetTypes: ['storj-files'],
      },
      {
        id: 'node-status',
        name: 'Node Status',
        description: 'Storage node status and disk usage (Node mode)',
        widgetTypes: ['storj-node-status'],
      },
      {
        id: 'satellites',
        name: 'Satellites',
        description: 'Connected satellites and reputation (Node mode)',
        widgetTypes: ['storj-satellites'],
      },
      {
        id: 'earnings',
        name: 'Earnings',
        description: 'Node operator earnings and payouts (Node mode)',
        widgetTypes: ['storj-earnings'],
      },
      {
        id: 'bandwidth',
        name: 'Bandwidth',
        description: 'Bandwidth usage statistics (Node mode)',
        widgetTypes: ['storj-bandwidth'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // S3 API
      {
        id: 's3-list-buckets',
        name: 'List Buckets',
        description: 'List all S3 buckets',
        method: 'GET',
        endpoint: 'S3: ListBuckets',
        implemented: true,
        category: 'S3 Storage',
        documentationUrl: 'https://storj.dev/dcs/api/s3/s3-compatible-gateway',
      },
      {
        id: 's3-list-objects',
        name: 'List Objects',
        description: 'List objects in a bucket',
        method: 'GET',
        endpoint: 'S3: ListObjectsV2',
        implemented: true,
        category: 'S3 Storage',
        parameters: [
          { name: 'bucket', type: 'string', required: true, description: 'Bucket name' },
          { name: 'maxKeys', type: 'number', required: false, description: 'Max objects to return' },
        ],
      },
      {
        id: 's3-head-bucket',
        name: 'Head Bucket',
        description: 'Check if bucket exists',
        method: 'GET',
        endpoint: 'S3: HeadBucket',
        implemented: false,
        category: 'S3 Storage',
      },

      // Node API
      {
        id: 'node-status',
        name: 'Get Node Status',
        description: 'Get storage node overview',
        method: 'GET',
        endpoint: '/api/sno',
        implemented: true,
        category: 'Node API',
      },
      {
        id: 'node-satellites',
        name: 'List Satellites',
        description: 'List connected satellites',
        method: 'GET',
        endpoint: '/api/sno/satellites',
        implemented: true,
        category: 'Node API',
      },
      {
        id: 'node-satellite-detail',
        name: 'Get Satellite Details',
        description: 'Get detailed stats for a satellite',
        method: 'GET',
        endpoint: '/api/sno/satellite/{id}',
        implemented: true,
        category: 'Node API',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Satellite ID' },
        ],
      },
      {
        id: 'node-payout',
        name: 'Get Estimated Payout',
        description: 'Get estimated earnings',
        method: 'GET',
        endpoint: '/api/sno/estimated-payout',
        implemented: true,
        category: 'Node API',
      },
      {
        id: 'node-notifications',
        name: 'Get Notifications',
        description: 'Get node notifications',
        method: 'GET',
        endpoint: '/api/notifications/list',
        implemented: false,
        category: 'Node API',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        ],
      },
    ];
  }
}
