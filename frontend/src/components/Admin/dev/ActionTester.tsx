import React, { useState } from 'react';
import axios from 'axios';

interface ActionInfo {
  id: string;
  name: string;
  description: string;
  parameters?: ActionParameter[];
  requiresConfirmation?: boolean;
}

interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  description?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
}

interface ActionTesterProps {
  action: ActionInfo;
  integrationId?: string;
  integrationName?: string;
  isDeployed: boolean;
}

export function ActionTester({
  action,
  integrationId,
  integrationName,
  isDeployed,
}: ActionTesterProps) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleParamChange = (name: string, value: string | number | boolean) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const executeAction = async () => {
    if (!integrationId) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowConfirmation(false);

    try {
      const response = await axios.post(`/api/integrations/${integrationId}/action`, {
        action: action.id,
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      setResult(response.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Action failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = () => {
    if (action.requiresConfirmation) {
      setShowConfirmation(true);
    } else {
      executeAction();
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
          expanded ? 'bg-gray-800' : 'bg-gray-800/50 hover:bg-gray-800'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-orange-400">{action.id}</code>
              <span className="text-sm text-gray-300">{action.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action.requiresConfirmation && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
              Requires confirmation
            </span>
          )}
          {action.parameters && action.parameters.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              {action.parameters.length} param{action.parameters.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 border-t border-gray-700 space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </label>
            <p className="mt-1 text-sm text-gray-300">{action.description}</p>
          </div>

          {/* Parameters */}
          {action.parameters && action.parameters.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Parameters
              </label>
              <div className="space-y-3 bg-gray-900 rounded-lg p-3">
                {action.parameters.map((param) => (
                  <div key={param.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-medium text-gray-300">
                        {param.name}
                      </label>
                      {param.required && (
                        <span className="text-red-400 text-xs">*required</span>
                      )}
                      <span className="text-xs text-gray-500">({param.type})</span>
                    </div>
                    {param.description && (
                      <p className="text-xs text-gray-500 mb-1">{param.description}</p>
                    )}
                    {param.type === 'boolean' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(params[param.name])}
                          onChange={(e) => handleParamChange(param.name, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-400">Enable</span>
                      </label>
                    ) : param.type === 'select' && param.options ? (
                      <select
                        value={String(params[param.name] ?? '')}
                        onChange={(e) => handleParamChange(param.name, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-primary-500"
                      >
                        <option value="">Select...</option>
                        {param.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : param.type === 'number' ? (
                      <input
                        type="number"
                        value={params[param.name] as number ?? ''}
                        onChange={(e) => handleParamChange(param.name, Number(e.target.value))}
                        placeholder={`Enter ${param.name}...`}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={params[param.name] as string ?? ''}
                        onChange={(e) => handleParamChange(param.name, e.target.value)}
                        placeholder={`Enter ${param.name}...`}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execute button */}
          <div className="flex items-center gap-3 pt-2">
            {isDeployed && integrationId ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecute();
                  }}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded transition-colors ${
                    action.requiresConfirmation
                      ? 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-600/50'
                      : 'bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Executing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Execute Action
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Deploy an integration to execute actions</span>
              </div>
            )}
          </div>

          {/* Confirmation dialog */}
          {showConfirmation && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">Confirm Action</span>
              </div>
              <p className="text-sm text-yellow-300 mb-3">
                Are you sure you want to execute "{action.name}"? This action may affect your system.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    executeAction();
                  }}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded transition-colors"
                >
                  Yes, Execute
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirmation(false);
                  }}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={`rounded-lg p-4 ${
                result.success
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
              }`}
            >
              <div className={`flex items-center gap-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="font-medium">{result.success ? 'Success' : 'Failed'}</span>
              </div>
              <p className={`mt-1 text-sm ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                {result.message}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {new Date().toLocaleString()}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Error</span>
              </div>
              <p className="mt-1 text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
