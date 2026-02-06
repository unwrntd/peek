import React, { useState, useEffect, useRef } from 'react';
import { networkApi } from '../../../api/client';
import { useRedact } from '../../../hooks/useRedact';
import { ScaledMetric } from '../../common/ScaledMetric';
import {
  NetworkTool,
  NetworkToolResponse,
  PingResult,
  TracerouteResult,
  DnsResult,
  PortResult,
  WhoisResult,
} from '../../../types';

interface NetworkToolsProps {
  title: string;
  config: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
}

const toolLabels: Record<NetworkTool, string> = {
  ping: 'Ping',
  traceroute: 'Traceroute',
  dns: 'DNS',
  port: 'Port',
  whois: 'WHOIS',
};

export function NetworkTools({ config }: NetworkToolsProps) {
  const { rIP, rHost } = useRedact();
  const host = (config.host as string) || '';
  const port = (config.port as number) || 443;
  const refreshInterval = (config.refreshInterval as number) || 30000;
  const showRawOutput = (config.showRawOutput as boolean) || false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';
  const visualization = (config.visualization as string) || 'cards';
  const isMetricMode = visualization === 'metric';
  const metricImageUrl = (config.metricImageUrl as string) || '';
  const metricImageSize = (config.metricImageSize as string) || 'md';

  // Image size classes for metric mode
  const imageSizeClasses: Record<string, string> = {
    xs: 'max-h-[30%]',
    sm: 'max-h-[50%]',
    md: 'max-h-[70%]',
    lg: 'max-h-[85%]',
    xl: 'max-h-[95%]',
  };
  const imageClass = imageSizeClasses[metricImageSize] || imageSizeClasses.md;

  // Metric size classes
  // When hideLabels is true, use larger sizes to fill space
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  } : {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-2xl' : 'text-base');

  // Tool toggles (default all off, user must enable)
  const showPing = Boolean(config.showPing);
  const showTraceroute = Boolean(config.showTraceroute);
  const showDns = Boolean(config.showDns);
  const showPort = Boolean(config.showPort);
  const showWhois = Boolean(config.showWhois);

  // Widget display toggles
  const showToolLabels = config.showToolLabels !== false;
  const showHost = config.showHost !== false;
  const showStatusIcons = config.showStatusIcons !== false;
  const showTime = config.showTime !== false;

  // Tool-specific element toggles
  const showLatency = config.showLatency !== false;
  const showPacketLoss = config.showPacketLoss !== false;
  const showHops = config.showHops !== false;
  const showRecords = config.showRecords !== false;
  const showRegistrar = config.showRegistrar !== false;
  const showDates = config.showDates !== false;
  const showNameServers = config.showNameServers !== false;

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, NetworkToolResponse | null>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Use refs to track current config without triggering re-renders
  const configRef = useRef({ host, port, showPing, showTraceroute, showDns, showPort, showWhois });
  const mountedRef = useRef(true);
  const runningRef = useRef(false);

  // Update ref when config changes
  useEffect(() => {
    configRef.current = { host, port, showPing, showTraceroute, showDns, showPort, showWhois };
  }, [host, port, showPing, showTraceroute, showDns, showPort, showWhois]);

  // Get enabled tools from current config
  const getEnabledTools = (): NetworkTool[] => {
    const tools: NetworkTool[] = [];
    const cfg = configRef.current;
    if (cfg.showPing) tools.push('ping');
    if (cfg.showTraceroute) tools.push('traceroute');
    if (cfg.showDns) tools.push('dns');
    if (cfg.showPort) tools.push('port');
    if (cfg.showWhois) tools.push('whois');
    return tools;
  };

  // Run a single tool
  const runSingleTool = async (tool: NetworkTool): Promise<void> => {
    const cfg = configRef.current;
    if (!cfg.host.trim()) return;

    setLoading(prev => ({ ...prev, [tool]: true }));

    try {
      let response: NetworkToolResponse;

      switch (tool) {
        case 'ping':
          response = await networkApi.ping(cfg.host.trim(), 4);
          break;
        case 'traceroute':
          response = await networkApi.traceroute(cfg.host.trim(), 30);
          break;
        case 'dns':
          response = await networkApi.dnsLookup(cfg.host.trim());
          break;
        case 'port':
          response = await networkApi.portCheck(cfg.host.trim(), cfg.port);
          break;
        case 'whois':
          response = await networkApi.whois(cfg.host.trim());
          break;
        default:
          throw new Error('Invalid tool');
      }

      if (mountedRef.current) {
        setResults(prev => ({ ...prev, [tool]: response }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setResults(prev => ({
          ...prev,
          [tool]: {
            success: false,
            tool,
            target: cfg.host,
            error: error instanceof Error ? error.message : 'Request failed',
            duration: 0,
          },
        }));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(prev => ({ ...prev, [tool]: false }));
      }
    }
  };

  // Run all enabled tools
  const runAllTools = async (): Promise<void> => {
    if (runningRef.current) return;

    const tools = getEnabledTools();
    const cfg = configRef.current;

    if (!cfg.host.trim() || tools.length === 0) return;

    runningRef.current = true;

    try {
      await Promise.all(tools.map(tool => runSingleTool(tool)));
      if (mountedRef.current) {
        setLastUpdated(new Date());
      }
    } finally {
      runningRef.current = false;
    }
  };

  // Effect for initial run and interval - only depends on stable values
  useEffect(() => {
    mountedRef.current = true;

    // Create stable key from config
    const toolsKey = [showPing, showTraceroute, showDns, showPort, showWhois].join(',');

    if (!host.trim()) return;

    // Run immediately
    runAllTools();

    // Set up interval
    const interval = setInterval(() => {
      runAllTools();
    }, refreshInterval);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, refreshInterval, showPing, showTraceroute, showDns, showPort, showWhois]);

  // Build enabled tools list for rendering
  const enabledTools: NetworkTool[] = [];
  if (showPing) enabledTools.push('ping');
  if (showTraceroute) enabledTools.push('traceroute');
  if (showDns) enabledTools.push('dns');
  if (showPort) enabledTools.push('port');
  if (showWhois) enabledTools.push('whois');

  const renderPingResult = (result: NetworkToolResponse, useScaled: boolean) => {
    const ping = result.parsed as PingResult;
    if (!ping) return null;

    // Use ScaledMetric for single metric display
    if (useScaled && showLatency && !showPacketLoss) {
      return (
        <ScaledMetric
          value={`${ping.avgMs.toFixed(1)}ms`}
          className="text-gray-900 dark:text-white"
        />
      );
    }

    if (hideLabels) {
      return (
        <div className="flex flex-col items-center justify-center space-y-1 h-full">
          {showLatency && (
            <div className={`font-bold ${metricClass} text-gray-900 dark:text-white leading-none`}>
              {ping.avgMs.toFixed(1)}ms
            </div>
          )}
          {showPacketLoss && (
            <div className={`font-medium ${metricClass} ${ping.lossPercent > 0 ? 'text-red-500' : 'text-green-500'} leading-none`}>
              {ping.received}/{ping.transmitted}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {showPacketLoss && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Packets:</span>
            <span className={`font-medium ${ping.lossPercent > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {ping.received}/{ping.transmitted} ({ping.lossPercent}% loss)
            </span>
          </div>
        )}
        {showLatency && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Latency:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {ping.avgMs.toFixed(1)}ms <span className="text-gray-400">(min: {ping.minMs.toFixed(1)}, max: {ping.maxMs.toFixed(1)})</span>
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderTracerouteResult = (result: NetworkToolResponse) => {
    const trace = result.parsed as TracerouteResult;
    if (!trace || !showHops) return null;

    return (
      <div className="space-y-0.5 text-xs max-h-24 overflow-y-auto">
        {trace.hops.slice(0, 10).map((hop) => (
          <div key={hop.hop} className="flex items-center gap-2">
            {!hideLabels && <span className="w-4 text-gray-400">{hop.hop}</span>}
            <span className={`flex-1 font-mono ${metricClass} text-gray-700 dark:text-gray-300 truncate`}>
              {hop.host === '*' ? '* * *' : rIP(hop.ip)}
            </span>
            {hop.times.length > 0 && (
              <span className={`${metricClass} text-gray-400`}>{hop.times[0].toFixed(1)}ms</span>
            )}
          </div>
        ))}
        {trace.hops.length > 10 && !hideLabels && (
          <div className="text-gray-400 text-center">+{trace.hops.length - 10} more hops</div>
        )}
      </div>
    );
  };

  const renderDnsResult = (result: NetworkToolResponse) => {
    const dns = result.parsed as DnsResult;
    if (!dns || !showRecords) return null;

    return (
      <div className="space-y-1 text-xs">
        {dns.records?.map((record, i) => (
          <div key={i} className={`flex items-start gap-2 ${hideLabels ? 'justify-center' : ''}`}>
            {!hideLabels && (
              <span className="px-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px]">
                {record.type}
              </span>
            )}
            <span className={`font-mono ${metricClass} text-gray-700 dark:text-gray-300 truncate`}>
              {record.addresses.slice(0, 2).map(addr => rIP(addr)).join(', ')}
              {record.addresses.length > 2 && !hideLabels && ` +${record.addresses.length - 2}`}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderPortResult = (result: NetworkToolResponse, useScaled: boolean) => {
    const portResult = result.parsed as PortResult;
    if (!portResult) return null;

    // Use ScaledMetric for single metric display
    if (useScaled) {
      return (
        <ScaledMetric
          value={portResult.open ? 'OPEN' : 'CLOSED'}
          className={portResult.open ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
        />
      );
    }

    if (hideLabels) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className={`flex items-center gap-2`}>
            <div className={`w-3 h-3 rounded-full ${portResult.open ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`${metricClass} font-bold ${portResult.open ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {portResult.open ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${portResult.open ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-gray-700 dark:text-gray-300">
          Port {portResult.port}: <span className="font-medium">{portResult.open ? 'OPEN' : 'CLOSED'}</span>
        </span>
        {portResult.responseTime && (
          <span className="text-gray-400">({portResult.responseTime}ms)</span>
        )}
      </div>
    );
  };

  const renderWhoisResult = (result: NetworkToolResponse) => {
    const whois = result.parsed as WhoisResult;
    if (!whois) return null;

    return (
      <div className="space-y-1 text-xs">
        {showRegistrar && whois.registrar && (
          <div className={`flex items-center ${hideLabels ? 'justify-center' : 'justify-between'}`}>
            {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Registrar:</span>}
            <span className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300 truncate ${hideLabels ? '' : 'ml-2'}`}>{whois.registrar}</span>
          </div>
        )}
        {showDates && whois.createdDate && (
          <div className={`flex items-center ${hideLabels ? 'justify-center' : 'justify-between'}`}>
            {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Created:</span>}
            <span className={`${metricClass} text-gray-700 dark:text-gray-300`}>{whois.createdDate.split('T')[0]}</span>
          </div>
        )}
        {showDates && whois.expiryDate && (
          <div className={`flex items-center ${hideLabels ? 'justify-center' : 'justify-between'}`}>
            {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Expires:</span>}
            <span className={`${metricClass} text-gray-700 dark:text-gray-300`}>{whois.expiryDate.split('T')[0]}</span>
          </div>
        )}
        {showNameServers && whois.nameServers && whois.nameServers.length > 0 && (
          <div className={`flex items-start ${hideLabels ? 'justify-center' : 'justify-between'}`}>
            {!hideLabels && <span className="text-gray-500 dark:text-gray-400">NS:</span>}
            <span className={`font-mono ${metricClass} text-gray-700 dark:text-gray-300 ${hideLabels ? '' : 'text-right ml-2'} truncate`}>
              {whois.nameServers.slice(0, 2).join(', ')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderToolResult = (tool: NetworkTool, useScaled: boolean = false) => {
    const result = results[tool];
    const isLoading = loading[tool];

    // For scaled mode, return just the metric
    if (useScaled && result?.parsed) {
      if (tool === 'ping') return renderPingResult(result, true);
      if (tool === 'port') return renderPortResult(result, true);
      // For other tools, fall through to normal rendering
    }

    const hasHeader = (showStatusIcons || showToolLabels) && !hideLabels;

    return (
      <div key={tool} className={`${hideLabels ? 'h-full flex flex-col justify-center' : 'border-b border-gray-100 dark:border-gray-700 last:border-b-0 py-2 first:pt-0 last:pb-0'}`}>
        {hasHeader && (
          <div className="flex items-center gap-2 mb-1">
            {showStatusIcons && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isLoading ? 'bg-yellow-500 animate-pulse' :
                result?.success ? 'bg-green-500' :
                result ? 'bg-red-500' : 'bg-gray-300'
              }`} />
            )}
            {showToolLabels && (
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                {toolLabels[tool]}
              </span>
            )}
            {isLoading && <span className="text-[10px] text-gray-400">loading...</span>}
          </div>
        )}

        {result?.error && !result.parsed && (
          <div className="text-xs text-red-500 truncate">{result.error}</div>
        )}

        {result?.parsed && (
          <>
            {tool === 'ping' && renderPingResult(result, false)}
            {tool === 'traceroute' && renderTracerouteResult(result)}
            {tool === 'dns' && renderDnsResult(result)}
            {tool === 'port' && renderPortResult(result, false)}
            {tool === 'whois' && renderWhoisResult(result)}
          </>
        )}

        {showRawOutput && result?.output && !hideLabels && (
          <pre className="mt-1 p-1 bg-gray-100 dark:bg-gray-900 rounded text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto max-h-16 whitespace-pre-wrap font-mono">
            {result.output}
          </pre>
        )}
      </div>
    );
  };

  // Not configured state
  if (!host.trim()) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        <div className="text-center">
          <div className="mb-1">No host configured</div>
          <div className="text-xs">Edit widget to set host and enable tools</div>
        </div>
      </div>
    );
  }

  if (enabledTools.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        <div className="text-center">
          <div className="mb-1">No tools enabled</div>
          <div className="text-xs">Edit widget to enable ping, DNS, etc.</div>
        </div>
      </div>
    );
  }

  const hasHeader = (showHost || showTime) && !hideLabels && !isMetricMode;
  const isSingleTool = enabledTools.length === 1;
  const singleTool = isSingleTool ? enabledTools[0] : null;
  // Use scaled metric for single simple tools (ping with just latency, or port check)
  const useScaledMetric = (hideLabels || isMetricMode) && isSingleTool && (
    (singleTool === 'ping' && showLatency && !showPacketLoss) ||
    (singleTool === 'port')
  );

  // Render metric mode - just the big scaled value
  const renderMetricMode = () => {
    if (enabledTools.length === 0) return null;

    // Use first enabled tool for metric mode
    const tool = enabledTools[0];
    const result = results[tool];
    const isLoading = loading[tool];

    if (isLoading && !result) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400 animate-pulse">Loading...</div>
        </div>
      );
    }

    if (!result?.parsed) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">--</div>
        </div>
      );
    }

    // Get the primary metric value based on tool type
    let metricValue = '--';
    let metricColor = 'text-gray-900 dark:text-white';

    switch (tool) {
      case 'ping': {
        const ping = result.parsed as PingResult;
        if (showLatency) {
          metricValue = `${ping.avgMs.toFixed(1)}ms`;
          // Color based on latency (green < 50ms, yellow < 150ms, red >= 150ms)
          if (ping.avgMs < 50) metricColor = 'text-green-600 dark:text-green-400';
          else if (ping.avgMs < 150) metricColor = 'text-yellow-600 dark:text-yellow-400';
          else metricColor = 'text-red-600 dark:text-red-400';
        } else if (showPacketLoss) {
          metricValue = `${ping.lossPercent}%`;
          metricColor = ping.lossPercent > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
        }
        break;
      }
      case 'port': {
        const portResult = result.parsed as PortResult;
        metricValue = portResult.open ? 'OPEN' : 'CLOSED';
        metricColor = portResult.open ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        break;
      }
      case 'dns': {
        const dns = result.parsed as DnsResult;
        if (dns.records && dns.records.length > 0 && dns.records[0].addresses.length > 0) {
          metricValue = rIP(dns.records[0].addresses[0]) || '--';
        }
        break;
      }
      case 'traceroute': {
        const trace = result.parsed as TracerouteResult;
        metricValue = `${trace.hops.length} hops`;
        break;
      }
      case 'whois': {
        const whois = result.parsed as WhoisResult;
        if (whois.expiryDate) {
          const expiry = new Date(whois.expiryDate);
          const daysUntil = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          metricValue = `${daysUntil}d`;
          if (daysUntil < 30) metricColor = 'text-red-600 dark:text-red-400';
          else if (daysUntil < 90) metricColor = 'text-yellow-600 dark:text-yellow-400';
          else metricColor = 'text-green-600 dark:text-green-400';
        }
        break;
      }
    }

    return (
      <div className="h-full w-full flex items-center justify-center gap-3">
        {metricImageUrl && (
          <img
            src={metricImageUrl}
            alt=""
            className={`h-full ${imageClass} w-auto object-contain flex-shrink-0`}
          />
        )}
        <div className={metricImageUrl ? 'flex-1 min-w-0' : 'w-full h-full'}>
          <ScaledMetric
            value={metricValue}
            className={metricColor}
          />
        </div>
      </div>
    );
  };

  // Handle metric mode
  if (isMetricMode) {
    if (!host.trim()) {
      return (
        <div className="h-full flex items-center justify-center">
          <ScaledMetric value="--" className="text-gray-400" />
        </div>
      );
    }
    if (enabledTools.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <ScaledMetric value="--" className="text-gray-400" />
        </div>
      );
    }
    return (
      <div className="h-full w-full">
        {renderMetricMode()}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {hasHeader && (
        <div className="flex items-center justify-between mb-2 pb-1">
          {showHost && (
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {rHost(host)}{showPort ? `:${port}` : ''}
            </span>
          )}
          {showTime && lastUpdated && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Results */}
      <div className={`flex-1 overflow-auto ${hideLabels ? '' : 'space-y-0'}`}>
        {useScaledMetric && singleTool ? (
          // Single tool with scaled metric - fill the widget
          renderToolResult(singleTool, true)
        ) : hideLabels && isSingleTool ? (
          // Single tool, hideLabels - center the result
          <div className="h-full flex items-center justify-center">
            {enabledTools.map(tool => renderToolResult(tool, false))}
          </div>
        ) : (
          enabledTools.map(tool => renderToolResult(tool, false))
        )}
      </div>
    </div>
  );
}
