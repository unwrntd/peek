import { Router, Request, Response } from 'express';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import * as dns from 'dns';
import * as net from 'net';
import { logger } from '../services/logger';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const dnsResolve = promisify(dns.resolve);

const router = Router();

// Validate hostname/IP to prevent command injection
function isValidHost(host: string): boolean {
  // Allow alphanumeric, dots, hyphens, and colons (for IPv6)
  const hostRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-.:]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  return hostRegex.test(host) && host.length <= 253;
}

// Validate port number
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

// Parse ping output for structured data
function parsePingOutput(output: string): {
  transmitted: number;
  received: number;
  lossPercent: number;
  minMs: number;
  avgMs: number;
  maxMs: number;
} | null {
  try {
    // Match packet statistics line: "4 packets transmitted, 4 received, 0% packet loss"
    const statsMatch = output.match(/(\d+) packets transmitted, (\d+) (?:packets )?received, (\d+(?:\.\d+)?)% packet loss/);

    // Match round-trip times in various formats:
    // Linux: "rtt min/avg/max/mdev = 1.234/2.345/3.456/0.123 ms"
    // macOS: "round-trip min/avg/max/stddev = 1.234/2.345/3.456/0.123 ms"
    // Alpine/BusyBox: "round-trip min/avg/max = 8.874/9.049/9.296 ms"
    const rttMatch = output.match(/(?:rtt|round-trip) min\/avg\/max(?:\/(?:mdev|stddev))? = ([\d.]+)\/([\d.]+)\/([\d.]+)/);

    if (statsMatch) {
      return {
        transmitted: parseInt(statsMatch[1], 10),
        received: parseInt(statsMatch[2], 10),
        lossPercent: parseFloat(statsMatch[3]),
        minMs: rttMatch ? parseFloat(rttMatch[1]) : 0,
        avgMs: rttMatch ? parseFloat(rttMatch[2]) : 0,
        maxMs: rttMatch ? parseFloat(rttMatch[3]) : 0,
      };
    }
  } catch {
    // Parse error, return null
  }
  return null;
}

// Parse WHOIS output for structured data
function parseWhoisOutput(output: string): {
  registrar?: string;
  createdDate?: string;
  expiryDate?: string;
  nameServers?: string[];
  registrant?: string;
} {
  const result: {
    registrar?: string;
    createdDate?: string;
    expiryDate?: string;
    nameServers?: string[];
    registrant?: string;
  } = {};

  try {
    // Common patterns in WHOIS output
    const registrarMatch = output.match(/Registrar:\s*(.+)/i) ||
                          output.match(/Registrar Name:\s*(.+)/i);
    if (registrarMatch) result.registrar = registrarMatch[1].trim();

    const createdMatch = output.match(/Creation Date:\s*(.+)/i) ||
                        output.match(/Created:\s*(.+)/i) ||
                        output.match(/Registration Date:\s*(.+)/i);
    if (createdMatch) result.createdDate = createdMatch[1].trim();

    const expiryMatch = output.match(/Expir(?:y|ation) Date:\s*(.+)/i) ||
                       output.match(/Registry Expiry Date:\s*(.+)/i);
    if (expiryMatch) result.expiryDate = expiryMatch[1].trim();

    const nsMatches = output.matchAll(/Name Server:\s*(.+)/gi);
    const nameServers: string[] = [];
    for (const match of nsMatches) {
      nameServers.push(match[1].trim().toLowerCase());
    }
    if (nameServers.length > 0) result.nameServers = nameServers;

    const registrantMatch = output.match(/Registrant(?:\s+Organization)?:\s*(.+)/i);
    if (registrantMatch) result.registrant = registrantMatch[1].trim();
  } catch {
    // Parse error
  }

  return result;
}

// Parse traceroute output for structured data
function parseTracerouteOutput(output: string): {
  hops: { hop: number; host: string; ip: string; times: number[] }[];
} {
  const hops: { hop: number; host: string; ip: string; times: number[] }[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Match lines like: " 1  router.local (192.168.1.1)  1.234 ms  1.456 ms  1.789 ms"
    // or: " 1  192.168.1.1  1.234 ms  1.456 ms  1.789 ms"
    // or: " 1  * * *" (timeout)
    const hopMatch = line.match(/^\s*(\d+)\s+(.+)$/);

    if (hopMatch) {
      const hopNum = parseInt(hopMatch[1], 10);
      const rest = hopMatch[2].trim();

      // Check for timeout
      if (rest === '* * *' || rest.match(/^\*\s+\*\s+\*/)) {
        hops.push({
          hop: hopNum,
          host: '*',
          ip: '*',
          times: [],
        });
        continue;
      }

      // Try to parse host and IP
      const hostIpMatch = rest.match(/^([^\s(]+)\s*(?:\(([^)]+)\))?\s*(.*)$/);
      if (hostIpMatch) {
        const hostOrIp = hostIpMatch[1];
        const ip = hostIpMatch[2] || hostOrIp;
        const timesStr = hostIpMatch[3] || '';

        // Extract timing values
        const times: number[] = [];
        const timeMatches = timesStr.matchAll(/([\d.]+)\s*ms/g);
        for (const match of timeMatches) {
          times.push(parseFloat(match[1]));
        }

        hops.push({
          hop: hopNum,
          host: hostIpMatch[2] ? hostOrIp : ip,
          ip: ip,
          times: times,
        });
      }
    }
  }

  return { hops };
}

// POST /ping - Ping a host
router.post('/ping', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { host, count = 4 } = req.body;

  try {
    if (!host) {
      res.status(400).json({ success: false, error: 'Host is required' });
      return;
    }

    if (!isValidHost(host)) {
      res.status(400).json({ success: false, error: 'Invalid host format' });
      return;
    }

    const pingCount = Math.min(Math.max(1, parseInt(count, 10) || 4), 10);

    logger.info('network', `Ping request: ${host} (count: ${pingCount})`);

    // Use ping command with timeout
    const { stdout, stderr } = await execFileAsync('ping', ['-c', String(pingCount), '-W', '5', host], {
      timeout: 30000,
    });

    const output = stdout + (stderr || '');
    const parsed = parsePingOutput(output);

    res.json({
      success: true,
      tool: 'ping',
      target: host,
      output: output,
      parsed: parsed,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const output = (error as { stdout?: string; stderr?: string })?.stdout ||
                   (error as { stderr?: string })?.stderr || errorMsg;

    logger.error('network', `Ping failed: ${host}`, { error: errorMsg });

    // Ping might "fail" but still have useful output (e.g., 100% packet loss)
    const parsed = parsePingOutput(output);

    res.json({
      success: false,
      tool: 'ping',
      target: host,
      output: output,
      parsed: parsed,
      error: errorMsg,
      duration: Date.now() - startTime,
    });
  }
});

// POST /traceroute - Trace route to host
router.post('/traceroute', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { host, maxHops = 30 } = req.body;

  try {
    if (!host) {
      res.status(400).json({ success: false, error: 'Host is required' });
      return;
    }

    if (!isValidHost(host)) {
      res.status(400).json({ success: false, error: 'Invalid host format' });
      return;
    }

    const hops = Math.min(Math.max(1, parseInt(maxHops, 10) || 30), 64);

    logger.info('network', `Traceroute request: ${host} (maxHops: ${hops})`);

    // Use traceroute command
    const { stdout, stderr } = await execFileAsync('traceroute', ['-m', String(hops), '-w', '3', host], {
      timeout: 120000, // Traceroute can take a while
    });

    const output = stdout + (stderr || '');
    const parsed = parseTracerouteOutput(output);

    res.json({
      success: true,
      tool: 'traceroute',
      target: host,
      output: output,
      parsed: parsed,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const output = (error as { stdout?: string; stderr?: string })?.stdout ||
                   (error as { stderr?: string })?.stderr || errorMsg;

    logger.error('network', `Traceroute failed: ${host}`, { error: errorMsg });

    res.json({
      success: false,
      tool: 'traceroute',
      target: host,
      output: output,
      parsed: parseTracerouteOutput(output),
      error: errorMsg,
      duration: Date.now() - startTime,
    });
  }
});

// POST /dns - DNS lookup
router.post('/dns', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { hostname } = req.body;

  try {
    if (!hostname) {
      res.status(400).json({ success: false, error: 'Hostname is required' });
      return;
    }

    if (!isValidHost(hostname)) {
      res.status(400).json({ success: false, error: 'Invalid hostname format' });
      return;
    }

    logger.info('network', `DNS lookup request: ${hostname}`);

    // Try to resolve multiple record types
    const results: { type: string; addresses: string[] }[] = [];

    // A records (IPv4)
    try {
      const ipv4 = await dnsResolve(hostname, 'A');
      if (ipv4.length > 0) {
        results.push({ type: 'A', addresses: ipv4 as string[] });
      }
    } catch {
      // No A records
    }

    // AAAA records (IPv6)
    try {
      const ipv6 = await dnsResolve(hostname, 'AAAA');
      if (ipv6.length > 0) {
        results.push({ type: 'AAAA', addresses: ipv6 as string[] });
      }
    } catch {
      // No AAAA records
    }

    // CNAME records
    try {
      const cname = await dnsResolve(hostname, 'CNAME');
      if (cname.length > 0) {
        results.push({ type: 'CNAME', addresses: cname as string[] });
      }
    } catch {
      // No CNAME records
    }

    // MX records
    try {
      const mx = await dnsResolve(hostname, 'MX') as { priority: number; exchange: string }[];
      if (mx.length > 0) {
        results.push({
          type: 'MX',
          addresses: mx.map(r => `${r.priority} ${r.exchange}`)
        });
      }
    } catch {
      // No MX records
    }

    if (results.length === 0) {
      res.json({
        success: false,
        tool: 'dns',
        target: hostname,
        output: `No DNS records found for ${hostname}`,
        error: 'No DNS records found',
        duration: Date.now() - startTime,
      });
      return;
    }

    // Build output string
    const outputLines = results.map(r => `${r.type}: ${r.addresses.join(', ')}`);

    res.json({
      success: true,
      tool: 'dns',
      target: hostname,
      output: outputLines.join('\n'),
      parsed: {
        hostname: hostname,
        records: results,
        addresses: results.find(r => r.type === 'A')?.addresses || [],
      },
      duration: Date.now() - startTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('network', `DNS lookup failed: ${hostname}`, { error: errorMsg });

    res.json({
      success: false,
      tool: 'dns',
      target: hostname,
      output: errorMsg,
      error: errorMsg,
      duration: Date.now() - startTime,
    });
  }
});

// POST /whois - WHOIS lookup
router.post('/whois', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { host } = req.body;

  try {
    if (!host) {
      res.status(400).json({ success: false, error: 'Host is required' });
      return;
    }

    if (!isValidHost(host)) {
      res.status(400).json({ success: false, error: 'Invalid host format' });
      return;
    }

    logger.info('network', `WHOIS request: ${host}`);

    const { stdout, stderr } = await execFileAsync('whois', [host], {
      timeout: 30000,
    });

    const output = stdout + (stderr || '');
    const parsed = parseWhoisOutput(output);

    res.json({
      success: true,
      tool: 'whois',
      target: host,
      output: output,
      parsed: parsed,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const output = (error as { stdout?: string; stderr?: string })?.stdout ||
                   (error as { stderr?: string })?.stderr || errorMsg;

    logger.error('network', `WHOIS failed: ${host}`, { error: errorMsg });

    res.json({
      success: false,
      tool: 'whois',
      target: host,
      output: output,
      error: errorMsg,
      duration: Date.now() - startTime,
    });
  }
});

// POST /port - Check if port is open
router.post('/port', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { host, port, timeout = 5000 } = req.body;

  try {
    if (!host) {
      res.status(400).json({ success: false, error: 'Host is required' });
      return;
    }

    if (!isValidHost(host)) {
      res.status(400).json({ success: false, error: 'Invalid host format' });
      return;
    }

    if (!port || !isValidPort(parseInt(port, 10))) {
      res.status(400).json({ success: false, error: 'Valid port (1-65535) is required' });
      return;
    }

    const portNum = parseInt(port, 10);
    const timeoutMs = Math.min(Math.max(1000, parseInt(timeout, 10) || 5000), 30000);

    logger.info('network', `Port check request: ${host}:${portNum}`);

    const isOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.connect(portNum, host);
    });

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      tool: 'port',
      target: `${host}:${portNum}`,
      output: isOpen
        ? `Port ${portNum} is OPEN on ${host} (${responseTime}ms)`
        : `Port ${portNum} is CLOSED or filtered on ${host}`,
      parsed: {
        host: host,
        port: portNum,
        open: isOpen,
        responseTime: isOpen ? responseTime : undefined,
      },
      duration: responseTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('network', `Port check failed: ${host}:${port}`, { error: errorMsg });

    res.json({
      success: false,
      tool: 'port',
      target: `${host}:${port}`,
      output: errorMsg,
      error: errorMsg,
      duration: Date.now() - startTime,
    });
  }
});

export default router;
