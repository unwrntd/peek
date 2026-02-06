import React, { useState, useCallback } from 'react';
import { ApiCapability, dataApi, CapabilityExecuteResponse } from '../../../api/client';
import { useRequestHistory } from '../../../hooks/useRequestHistory';

interface CapabilityTesterProps {
  capability: ApiCapability;
  integrationId: string;
  integrationName: string;
  onClose: () => void;
}

export function CapabilityTester({
  capability,
  integrationId,
  integrationName,
  onClose,
}: CapabilityTesterProps) {
  const [parameters, setParameters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    capability.parameters?.forEach((param) => {
      initial[param.name] = '';
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CapabilityExecuteResponse | null>(null);
  const [expandedResponse, setExpandedResponse] = useState(true);
  const { addEntry } = useRequestHistory();

  const isDestructive = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(capability.method);

  const handleParameterChange = (name: string, value: string) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  const parseParameterValue = (value: string, type: string): unknown => {
    if (!value) return undefined;
    switch (type.toLowerCase()) {
      case 'number':
      case 'integer':
        return Number(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'object':
      case 'array':
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  const getResolvedEndpoint = () => {
    return capability.endpoint.replace(/\{(\w+)\}/g, (match, key) => {
      const value = parameters[key];
      return value || match;
    });
  };

  const handleExecute = useCallback(async () => {
    setLoading(true);
    setResponse(null);

    // Build parameters object with proper types (before try block so it's available in catch)
    const parsedParams: Record<string, unknown> = {};
    capability.parameters?.forEach((param) => {
      const value = parameters[param.name];
      if (value) {
        parsedParams[param.name] = parseParameterValue(value, param.type);
      }
    });

    try {
      const result = await dataApi.executeCapability(integrationId, {
        capabilityId: capability.id,
        method: capability.method,
        endpoint: capability.endpoint,
        parameters: Object.keys(parsedParams).length > 0 ? parsedParams : undefined,
      });

      setResponse(result);

      // Add to request history
      addEntry({
        integrationId,
        integrationName,
        capabilityId: capability.id,
        capabilityName: capability.name,
        method: capability.method,
        endpoint: capability.endpoint,
        parameters: Object.keys(parsedParams).length > 0 ? parsedParams : undefined,
        response: {
          success: result.success,
          statusCode: result.statusCode,
          timing: result.timing,
          data: result.data,
          error: result.error,
        },
      });
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timing: 0,
      };
      setResponse(errorResponse);

      // Add failed request to history
      addEntry({
        integrationId,
        integrationName,
        capabilityId: capability.id,
        capabilityName: capability.name,
        method: capability.method,
        endpoint: capability.endpoint,
        parameters: Object.keys(parsedParams).length > 0 ? parsedParams : undefined,
        response: {
          success: false,
          timing: 0,
          error: errorResponse.error,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [capability, integrationId, integrationName, parameters, addEntry]);

  const hasRequiredParams = () => {
    if (!capability.parameters) return true;
    return capability.parameters
      .filter((p) => p.required)
      .every((p) => parameters[p.name]?.trim());
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'POST':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PUT':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'PATCH':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Test API Endpoint</h2>
              <p className="text-sm text-gray-400">{integrationName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Endpoint Info */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-1 text-xs font-mono font-medium rounded border ${getMethodColor(
                  capability.method
                )}`}
              >
                {capability.method}
              </span>
              <code className="text-sm text-gray-300 font-mono">{getResolvedEndpoint()}</code>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{capability.name}</h3>
              <p className="text-xs text-gray-400 mt-1">{capability.description}</p>
            </div>
          </div>

          {/* Warning for destructive operations */}
          {isDestructive && (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-400">Caution</p>
                <p className="text-xs text-amber-300/80">
                  This {capability.method} request may modify data on your {integrationName} server.
                  Review parameters carefully before executing.
                </p>
              </div>
            </div>
          )}

          {/* Parameters */}
          {capability.parameters && capability.parameters.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white">Parameters</h3>
              <div className="space-y-3">
                {capability.parameters.map((param) => (
                  <div key={param.name} className="space-y-1">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="font-mono">{param.name}</span>
                      <span className="text-xs text-gray-500">({param.type})</span>
                      {param.required && <span className="text-xs text-orange-400">required</span>}
                    </label>
                    {param.description && (
                      <p className="text-xs text-gray-500">{param.description}</p>
                    )}
                    {param.type.toLowerCase() === 'boolean' ? (
                      <select
                        value={parameters[param.name]}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                      >
                        <option value="">-- Select --</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : ['object', 'array', 'json'].includes(param.type.toLowerCase()) ? (
                      <textarea
                        value={parameters[param.name]}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        placeholder={`Enter ${param.type} as JSON`}
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-primary-500"
                      />
                    ) : (
                      <input
                        type={param.type.toLowerCase() === 'number' ? 'number' : 'text'}
                        value={parameters[param.name]}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        placeholder={`Enter ${param.name}`}
                        className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="space-y-2">
              <button
                onClick={() => setExpandedResponse(!expandedResponse)}
                className="flex items-center justify-between w-full text-sm font-medium text-white"
              >
                <div className="flex items-center gap-2">
                  <span>Response</span>
                  {response.success ? (
                    <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                      {response.statusCode || 'OK'}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                      {response.statusCode || 'Error'}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{response.timing}ms</span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedResponse ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {expandedResponse && (
                <div
                  className={`rounded-lg border p-3 max-h-64 overflow-auto ${
                    response.success
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-red-900/20 border-red-500/30'
                  }`}
                >
                  {response.error && (
                    <p className="text-sm text-red-400 mb-2">{response.error}</p>
                  )}
                  {response.data !== undefined && (
                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  )}
                  {!response.error && response.data === undefined && (
                    <p className="text-sm text-gray-400 italic">No response data</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleExecute}
            disabled={loading || !hasRequiredParams()}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              loading || !hasRequiredParams()
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : isDestructive
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-primary-600 hover:bg-primary-500 text-white'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Executing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>Execute</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
