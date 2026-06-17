import React, { useEffect, useState } from 'react';
import {
  PlayCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Play,
  GitBranch,
  ExternalLink,
  FileCode,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow, formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { Workflow, WorkflowRun } from '../../shared/types.js';

const getWorkflowIcon = (name: string) => {
  if (name.includes('CI') || name.includes('Build')) return '🔨';
  if (name.includes('Deploy')) return '🚀';
  if (name.includes('Release')) return '📦';
  if (name.includes('Nightly')) return '🌙';
  if (name.includes('Test')) return '🧪';
  return '⚙️';
};

const getStatusColor = (status: string, conclusion: string | null) => {
  if (status === 'in_progress') return 'border-status-running bg-status-running/10';
  if (conclusion === 'success') return 'border-status-success bg-status-success/10';
  if (conclusion === 'failure') return 'border-status-failure bg-status-failure/10';
  if (conclusion === 'cancelled') return 'border-gray-500 bg-gray-500/10';
  return 'border-gray-600 bg-gray-600/10';
};

const getStatusIcon = (status: string, conclusion: string | null) => {
  if (status === 'in_progress') return <Loader2 className="w-4 h-4 text-status-running animate-spin" />;
  if (conclusion === 'success') return <CheckCircle2 className="w-4 h-4 text-status-success" />;
  if (conclusion === 'failure') return <XCircle className="w-4 h-4 text-status-failure" />;
  if (conclusion === 'cancelled') return <XCircle className="w-4 h-4 text-gray-500" />;
  return <Clock className="w-4 h-4 text-gray-500" />;
};

const getStatusText = (status: string, conclusion: string | null) => {
  if (status === 'in_progress') return '运行中';
  if (conclusion === 'success') return '成功';
  if (conclusion === 'failure') return '失败';
  if (conclusion === 'cancelled') return '已取消';
  if (conclusion === 'skipped') return '已跳过';
  return '等待中';
};

interface TriggerModalProps {
  workflow: Workflow;
  repoFullName: string;
  onClose: () => void;
  onTrigger: (ref: string, inputs?: Record<string, string>) => void;
  isTriggering: boolean;
}

const TriggerModal: React.FC<TriggerModalProps> = ({
  workflow,
  repoFullName,
  onClose,
  onTrigger,
  isTriggering,
}) => {
  const [ref, setRef] = useState('main');
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const branches = ['main', 'develop', 'feature/auth', 'feature/new-ui'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onTrigger(ref, Object.keys(inputs).length > 0 ? inputs : undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 w-full max-w-md shadow-2xl animate-fadeIn">
        <div className="p-6 border-b border-bg-tertiary/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-2xl">
              {getWorkflowIcon(workflow.name)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">触发工作流</h2>
              <p className="text-sm text-gray-400">{workflow.name}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择分支
            </label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className="w-full bg-bg-tertiary/30 border border-bg-tertiary/50 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              工作流文件
            </label>
            <div className="flex items-center gap-2 bg-bg-tertiary/30 rounded-lg px-3 py-2.5">
              <FileCode className="w-4 h-4 text-gray-400" />
              <code className="text-sm text-gray-300 font-mono">{workflow.path}</code>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-bg-tertiary/30 border border-bg-tertiary/50 rounded-lg text-white hover:bg-bg-tertiary/50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isTriggering}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-lg text-white font-medium hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  触发中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  立即触发
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface WorkflowCardProps {
  workflow: Workflow;
  repoFullName: string;
  onTrigger: () => void;
  isTriggering: boolean;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  repoFullName,
  onTrigger,
  isTriggering,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 overflow-hidden hover:border-brand-primary/30 transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center text-3xl border border-brand-primary/20">
              {getWorkflowIcon(workflow.name)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">{workflow.name}</h3>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5" />
                  <code className="font-mono text-xs">{workflow.path.split('/').pop()}</code>
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    workflow.state === 'active'
                      ? 'bg-status-success/20 text-status-success'
                      : 'bg-gray-500/20 text-gray-400'
                  )}
                >
                  {workflow.state === 'active' ? '已启用' : '已禁用'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onTrigger}
            disabled={isTriggering || workflow.state !== 'active'}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-lg text-white font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTriggering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4" />
            )}
            触发
          </button>
        </div>

        {workflow.lastRun && (
          <div className="mt-4 pt-4 border-t border-bg-tertiary/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">最近运行</span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                {expanded ? (
                  <>
                    收起 <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    查看详情 <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>

            <div
              className={cn(
                'rounded-xl border p-4',
                getStatusColor(workflow.lastRun.status, workflow.lastRun.conclusion)
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(workflow.lastRun.status, workflow.lastRun.conclusion)}
                  <div>
                    <p className="text-sm font-medium text-white">#{workflow.lastRun.id} · {workflow.lastRun.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(workflow.lastRun.createdAt)} · {formatDistanceToNow(workflow.lastRun.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium',
                      workflow.lastRun.status === 'in_progress'
                        ? 'bg-status-running/20 text-status-running'
                        : workflow.lastRun.conclusion === 'success'
                        ? 'bg-status-success/20 text-status-success'
                        : 'bg-status-failure/20 text-status-failure'
                    )}
                  >
                    {getStatusText(workflow.lastRun.status, workflow.lastRun.conclusion)}
                  </span>
                  <a
                    href={workflow.lastRun.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">开始时间</p>
                    <p className="text-sm text-white">{formatDate(workflow.lastRun.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">更新时间</p>
                    <p className="text-sm text-white">{formatDate(workflow.lastRun.updatedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">状态</p>
                    <p className="text-sm text-white">{workflow.lastRun.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">结果</p>
                    <p className="text-sm text-white">{workflow.lastRun.conclusion || '-'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Workflows: React.FC = () => {
  const {
    repositories,
    workflows,
    workflowRuns,
    selectedRepo,
    setRepositories,
    setWorkflows,
    setWorkflowRuns,
    updateWorkflowRun,
    setSelectedRepo,
    setLoading,
    isLoading,
    setError,
    getError,
  } = useDashboardStore();

  const { subscribe, subscribeToAllRepos } = useWebSocket();
  const [triggerModal, setTriggerModal] = useState<{
    workflow: Workflow;
    repoFullName: string;
  } | null>(null);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading('workflows', true);
      try {
        const repos = await apiService.getRepositories();
        setRepositories(repos);

        for (const repo of repos) {
          const [owner, name] = repo.fullName.split('/');
          const [wfs, runs] = await Promise.all([
            apiService.getWorkflows(owner, name),
            apiService.getWorkflowRuns(owner, name),
          ]);
          setWorkflows(repo.fullName, wfs);
          setWorkflowRuns(repo.fullName, runs);
        }
      } catch (error) {
        console.error('Failed to load workflows:', error);
      } finally {
        setLoading('workflows', false);
      }
    };

    loadData();
  }, [setRepositories, setWorkflows, setWorkflowRuns, setLoading]);

  useEffect(() => {
    if (repositories.length > 0) {
      const repoFullNames = repositories.map((r) => r.fullName);
      subscribeToAllRepos(repoFullNames);
    }
  }, [repositories, subscribeToAllRepos]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'workflow:updated') {
        const run = event.data;
        updateWorkflowRun(run);

        if (run.repoFullName) {
          useDashboardStore.setState((state) => {
            const newWfMap = new Map(state.workflows);
            const repoWfs = newWfMap.get(run.repoFullName);
            if (repoWfs) {
              const updatedWfs = repoWfs.map((wf) => {
                if (wf.lastRun && wf.lastRun.id === run.id) {
                  return { ...wf, lastRun: { ...run } };
                }
                if (wf.name === run.name) {
                  const existingLastRun = wf.lastRun;
                  if (!existingLastRun || new Date(run.updatedAt) >= new Date(existingLastRun.updatedAt)) {
                    return { ...wf, lastRun: { ...run } };
                  }
                }
                return wf;
              });
              newWfMap.set(run.repoFullName, updatedWfs);
            }

            const newRunMap = new Map(state.workflowRuns);
            const repoRuns = newRunMap.get(run.repoFullName) || [];
            const runIdx = repoRuns.findIndex((r) => r.id === run.id);
            let updatedRuns;
            if (runIdx >= 0) {
              updatedRuns = [...repoRuns];
              updatedRuns[runIdx] = { ...run };
            } else {
              updatedRuns = [{ ...run }, ...repoRuns];
            }
            newRunMap.set(run.repoFullName, updatedRuns.sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            ));

            return { workflows: newWfMap, workflowRuns: newRunMap };
          });
        }
      }
    });
    return unsubscribe;
  }, [subscribe, updateWorkflowRun]);

  const displayRepo = selectedRepo || repositories[0]?.fullName;
  const currentWorkflows = displayRepo ? workflows.get(displayRepo) || [] : [];

  const handleTriggerWorkflow = async (
    workflow: Workflow,
    repoFullName: string,
    ref: string,
    inputs?: Record<string, string>
  ) => {
    setTriggeringId(workflow.id);
    setError('workflow-trigger', null);

    const optimisticRun: WorkflowRun & { repoFullName: string } = {
      id: Date.now(),
      name: workflow.name,
      status: 'queued',
      conclusion: null,
      htmlUrl: `https://github.com/${repoFullName}/actions`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repoFullName,
    };

    const currentWfs = workflows.get(repoFullName) || [];
    const optimisticWfs = currentWfs.map((wf) =>
      wf.id === workflow.id ? { ...wf, lastRun: optimisticRun } : wf
    );
    setWorkflows(repoFullName, optimisticWfs);

    const currentRuns = workflowRuns.get(repoFullName) || [];
    setWorkflowRuns(repoFullName, [optimisticRun, ...currentRuns]);

    try {
      const [owner, name] = repoFullName.split('/');
      const result = await apiService.triggerWorkflow(owner, name, workflow.id, ref, inputs);
      setTriggerModal(null);

      const newRun: WorkflowRun & { repoFullName: string } = {
        id: result.id,
        name: result.name,
        status: result.status,
        conclusion: result.conclusion,
        htmlUrl: result.htmlUrl,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        repoFullName: result.repoFullName || repoFullName,
      };

      const updatedWfs = currentWfs.map((wf) =>
        wf.id === workflow.id ? { ...wf, lastRun: newRun } : wf
      );
      setWorkflows(repoFullName, updatedWfs);

      const updatedRuns = currentRuns.map((r) =>
        r.id === optimisticRun.id ? newRun : r
      );
      setWorkflowRuns(repoFullName, updatedRuns);
    } catch (error: any) {
      console.error('Failed to trigger workflow:', error);
      setError('workflow-trigger', error.message || '触发工作流失败');
      const revertedWfs = currentWfs.map((wf) =>
        wf.id === workflow.id ? { ...wf, lastRun: workflow.lastRun } : wf
      );
      setWorkflows(repoFullName, revertedWfs);

      const revertedRuns = currentRuns.filter((r) => r.id !== optimisticRun.id);
      setWorkflowRuns(repoFullName, revertedRuns);
    } finally {
      setTriggeringId(null);
    }
  };

  const handleRefresh = async () => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.split('/');
    setLoading('workflows-refresh', true);
    try {
      const [wfs, runs] = await Promise.all([
        apiService.getWorkflows(owner, name),
        apiService.getWorkflowRuns(owner, name),
      ]);
      setWorkflows(selectedRepo, wfs);
      setWorkflowRuns(selectedRepo, runs);
    } catch (error) {
      console.error('Failed to refresh workflows:', error);
    } finally {
      setLoading('workflows-refresh', false);
    }
  };

  const triggerError = getError('workflow-trigger');
  const currentRuns = displayRepo ? workflowRuns.get(displayRepo) || [] : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-display mb-1">工作流触发</h1>
          <p className="text-gray-400">一键触发GitHub Actions工作流，实时同步执行状态</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedRepo || ''}
            onChange={(e) => setSelectedRepo(e.target.value || null)}
            className="bg-bg-secondary border border-bg-tertiary/50 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
          >
            <option value="">全部仓库</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.fullName}>
                {repo.fullName}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={isLoading('workflows-refresh')}
            className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-bg-tertiary/50 rounded-lg text-white hover:border-brand-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading('workflows-refresh') && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {triggerError && (
        <div className="bg-status-failure/10 border border-status-failure/30 rounded-xl p-4 text-status-failure">
          {triggerError}
        </div>
      )}

      {isLoading('workflows') ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">工作流</h2>
            <div className="grid gap-4">
              {currentWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  repoFullName={displayRepo}
                  onTrigger={() => setTriggerModal({ workflow, repoFullName: displayRepo })}
                  isTriggering={triggeringId === workflow.id}
                />
              ))}

              {currentWorkflows.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                  <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无可用工作流</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">最近运行</h2>
            <div className="space-y-3">
              {currentRuns.map((run) => (
                <div
                  key={run.id}
                  className={cn(
                    'rounded-xl border p-4 flex items-center justify-between',
                    getStatusColor(run.status, run.conclusion)
                  )}
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(run.status, run.conclusion)}
                    <div>
                      <p className="text-sm font-medium text-white">
                        #{run.id} · {run.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(run.createdAt)} · {formatDistanceToNow(run.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium',
                        run.status === 'in_progress'
                          ? 'bg-status-running/20 text-status-running'
                          : run.conclusion === 'success'
                          ? 'bg-status-success/20 text-status-success'
                          : run.conclusion === 'failure'
                          ? 'bg-status-failure/20 text-status-failure'
                          : 'bg-gray-500/20 text-gray-400'
                      )}
                    >
                      {getStatusText(run.status, run.conclusion)}
                    </span>
                    {run.htmlUrl && (
                      <a
                        href={run.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {currentRuns.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>暂无运行记录</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {triggerModal && (
        <TriggerModal
          workflow={triggerModal.workflow}
          repoFullName={triggerModal.repoFullName}
          onClose={() => setTriggerModal(null)}
          onTrigger={(ref, inputs) =>
            handleTriggerWorkflow(triggerModal.workflow, triggerModal.repoFullName, ref, inputs)
          }
          isTriggering={triggeringId === triggerModal.workflow.id}
        />
      )}
    </div>
  );
};

export default Workflows;
