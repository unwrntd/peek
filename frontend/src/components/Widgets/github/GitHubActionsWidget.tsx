import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface GitHubUser {
  login: string;
  avatar_url: string;
}

interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  html_url: string;
  event: string;
  actor: GitHubUser;
  run_started_at: string;
  updated_at: string;
}

interface ActionsData {
  runs: GitHubWorkflowRun[];
}

interface GitHubActionsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubActionsWidget({ integrationId, config, widgetId }: GitHubActionsWidgetProps) {
  const repo = (config.repo as string) || '';

  const { data, loading, error } = useWidgetData<ActionsData>({
    integrationId,
    metric: 'actions-status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const maxItems = (config.maxItems as number) || 10;
  const showWorkflow = config.showWorkflow !== false;
  const showBranch = config.showBranch !== false;
  const showDuration = config.showDuration !== false;
  const showTrigger = config.showTrigger !== false;
  const showActor = config.showActor !== false;

  const runs = useMemo(() => {
    if (!data?.runs) return [];
    let filteredRuns = [...data.runs];

    // Apply status filter
    const statusFilter = config.status as string;
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'success' || statusFilter === 'failure') {
        filteredRuns = filteredRuns.filter(r => r.conclusion === statusFilter);
      } else if (statusFilter === 'in_progress') {
        filteredRuns = filteredRuns.filter(r => r.status === 'in_progress');
      }
    }

    return filteredRuns.slice(0, maxItems);
  }, [data?.runs, config.status, maxItems]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);

    if (diffMins === 0) return `${diffSecs}s`;
    return `${diffMins}m ${diffSecs}s`;
  };

  const handleRunClick = (run: GitHubWorkflowRun) => {
    window.open(run.html_url, '_blank', 'noopener,noreferrer');
  };

  const getStatusIcon = (run: GitHubWorkflowRun) => {
    if (run.status === 'in_progress' || run.status === 'queued') {
      return (
        <div className="w-4 h-4 rounded-full bg-yellow-500 animate-pulse" />
      );
    }
    switch (run.conclusion) {
      case 'success':
        return (
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'failure':
        return (
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'cancelled':
        return (
          <div className="w-4 h-4 rounded-full bg-gray-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'skipped':
        return (
          <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 rounded-full bg-gray-300" />
        );
    }
  };

  if (!repo) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
          Configure a repository (owner/repo) in widget settings
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-1 overflow-y-auto max-h-full">
          {runs.map(run => (
            <div
              key={run.id}
              className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              onClick={() => handleRunClick(run)}
              title={`Open workflow run`}
            >
              <div className="flex items-start gap-2">
                {getStatusIcon(run)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {showWorkflow && (
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {run.name}
                      </span>
                    )}
                  </div>
                  {!hideLabels && (
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {showBranch && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l-3 3m0 0l3 3m-3-3h7a4 4 0 010 8H6" />
                          </svg>
                          {run.head_branch}
                        </span>
                      )}
                      {showTrigger && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                          {run.event}
                        </span>
                      )}
                      {showDuration && run.status === 'completed' && (
                        <span>
                          {formatDuration(run.run_started_at, run.updated_at)}
                        </span>
                      )}
                      <span>{formatDate(run.run_started_at)}</span>
                      {showActor && (
                        <span className="flex items-center gap-1">
                          <img
                            src={run.actor.avatar_url}
                            alt={run.actor.login}
                            className="w-4 h-4 rounded-full"
                          />
                          {run.actor.login}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {runs.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No workflow runs found
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
