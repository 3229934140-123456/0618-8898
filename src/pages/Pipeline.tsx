import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  RefreshCw,
  Play,
  GitCommit,
  User,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDuration, formatDistanceToNow, formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { PipelineRun, PipelineStage, PipelineStep } from '../../shared/types.js';

const stageConfig = {
  build: { label: '构建', color: 'from-blue-500 to-cyan-500', icon: '🔨' },
  test: { label: '测试', color: 'from-purple-500 to-pink-500', icon: '🧪' },
  deploy: { label: '部署', color: 'from-green-500 to-emerald-500', icon: '🚀' },
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-status-success" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-status-failure" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-status-running animate-spin" />;
    case 'skipped':
      return <Circle className="w-4 h-4 text-gray-500" />;
    default:
      return <Circle className="w-4 h-4 text-gray-600" />;
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'success':
      return 'bg-status-success/20 text-status-success border-status-success/30';
    case 'failed':
      return 'bg-status-failure/20 text-status-failure border-status-failure/30';
    case 'running':
      return 'bg-status-running/20 text-status-running border-status-running/30';
    case 'skipped':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-600/20 text-gray-400 border-gray-600/30';
  }
};

interface StepItemProps {
  step: PipelineStep;
  isLast: boolean;
}

const StepItem: React.FC<StepItemProps> = ({ step, isLast }) => {
  return (
    <div className="relative pl-6 pb-4 last:pb-0">
      {!isLast && (
        <div
          className={cn(
            'absolute left-[7px] top-5 w-0.5 h-full',
            step.status === 'success'
              ? 'bg-status-success'
              : step.status === 'failed'
              ? 'bg-status-failure'
              : step.status === 'running'
              ? 'bg-status-running'
              : 'bg-gray-700'
          )}
        />
      )}
      <div className="absolute left-0 top-0">{getStatusIcon(step.status)}</div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{step.name}</p>
          {step.logSummary && (
            <p className="text-xs text-gray-400 mt-1">{step.logSummary}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(step.durationSeconds)}</span>
        </div>
      </div>
    </div>
  );
};

interface StageCardProps {
  stage: PipelineStage;
  isExpanded: boolean;
  onToggle: () => void;
}

const StageCard: React.FC<StageCardProps> = ({ stage, isExpanded, onToggle }) => {
  const config = stageConfig[stage.name];
  const passedSteps = stage.steps.filter((s) => s.status === 'success').length;
  const totalSteps = stage.steps.length;

  return (
    <div className="bg-bg-secondary rounded-xl border border-bg-tertiary/50 overflow-hidden transition-all duration-300 hover:border-brand-primary/30">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-bg-tertiary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl shadow-lg',
              config.color
            )}
          >
            {config.icon}
          </div>
          <div className="text-left">
            <h3 className="font-bold text-white">{config.label}</h3>
            <p className="text-xs text-gray-400">
              {passedSteps}/{totalSteps} 步骤完成
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border',
              getStatusBadgeClass(stage.status)
            )}
          >
            {stage.status === 'running' ? '运行中' : stage.status === 'success' ? '成功' : stage.status === 'failed' ? '失败' : stage.status === 'skipped' ? '已跳过' : '等待中'}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(stage.durationSeconds)}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-bg-tertiary/50 pt-4">
          {stage.steps.map((step, idx) => (
            <StepItem
              key={step.id}
              step={step}
              isLast={idx === stage.steps.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface PipelineRunCardProps {
  run: PipelineRun;
  isExpanded: boolean;
  onToggle: () => void;
}

const PipelineRunCard: React.FC<PipelineRunCardProps> = ({ run, isExpanded, onToggle }) => {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['build']));

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const overallStatus = run.stages.every((s) => s.status === 'success')
    ? 'success'
    : run.stages.some((s) => s.status === 'failed')
    ? 'failed'
    : run.stages.some((s) => s.status === 'running')
    ? 'running'
    : 'pending';

  const totalDuration = run.stages.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

  return (
    <div className="bg-bg-secondary/80 rounded-2xl border border-bg-tertiary/50 overflow-hidden transition-all duration-300 hover:border-brand-primary/20 shadow-card">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center shadow-lg',
                overallStatus === 'success'
                  ? 'bg-gradient-to-br from-status-success to-status-success/60'
                  : overallStatus === 'failed'
                  ? 'bg-gradient-to-br from-status-failure to-status-failure/60'
                  : overallStatus === 'running'
                  ? 'bg-gradient-to-br from-status-running to-status-running/60 animate-pulse'
                  : 'bg-gradient-to-br from-gray-600 to-gray-700'
              )}
            >
              {overallStatus === 'running' ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : overallStatus === 'success' ? (
                <CheckCircle2 className="w-7 h-7 text-white" />
              ) : overallStatus === 'failed' ? (
                <XCircle className="w-7 h-7 text-white" />
              ) : (
                <Play className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    getStatusBadgeClass(overallStatus)
                  )}
                >
                  #{run.id}
                </span>
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5" />
                  {run.branch}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300 mb-2">
                <span className="flex items-center gap-1">
                  <GitCommit className="w-3.5 h-3.5" />
                  <code className="font-mono text-xs bg-bg-tertiary/50 px-1.5 py-0.5 rounded">
                    {run.commitSha.slice(0, 7)}
                  </code>
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {run.trigger === 'push' ? '代码推送' : run.trigger === 'pull_request' ? 'PR触发' : '手动触发'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{formatDate(run.createdAt)} · {formatDistanceToNow(run.createdAt)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white font-mono">{formatDuration(totalDuration)}</p>
            <p className="text-xs text-gray-500">总耗时</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {run.stages.map((stage) => {
            const config = stageConfig[stage.name];
            return (
              <div
                key={stage.id}
                className={cn(
                  'flex-1 h-2 rounded-full overflow-hidden bg-bg-tertiary/50',
                  stage.status === 'running' && 'animate-pulse'
                )}
              >
                <div
                  className={cn(
                    'h-full bg-gradient-to-r transition-all duration-500',
                    config.color,
                    stage.status === 'pending' ? 'w-0 opacity-30' : stage.status === 'running' ? 'w-2/3' : 'w-full'
                  )}
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-white transition-colors py-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              收起详情
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              展开详情
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-bg-tertiary/50 p-5 space-y-4 bg-bg-tertiary/10">
          {run.stages.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              isExpanded={expandedStages.has(stage.id)}
              onToggle={() => toggleStage(stage.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Pipeline: React.FC = () => {
  const {
    repositories,
    pipelineRuns,
    selectedRepo,
    setRepositories,
    setPipelineRuns,
    updatePipelineRun,
    setSelectedRepo,
    setLoading,
    isLoading,
  } = useDashboardStore();

  const { subscribe } = useWebSocket();
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      setLoading('pipeline', true);
      try {
        const repos = await apiService.getRepositories();
        setRepositories(repos);

        for (const repo of repos) {
          const [owner, name] = repo.fullName.split('/');
          const runs = await apiService.getPipelineRuns(owner, name);
          setPipelineRuns(repo.fullName, runs);
        }
      } catch (error) {
        console.error('Failed to load pipeline data:', error);
      } finally {
        setLoading('pipeline', false);
      }
    };

    loadData();
  }, [setRepositories, setPipelineRuns, setLoading]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'pipeline:updated') {
        updatePipelineRun(event.data);
      }
    });
    return unsubscribe;
  }, [subscribe, updatePipelineRun]);

  const toggleRun = (runId: number) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.split('/');
    setLoading('pipeline-refresh', true);
    try {
      const runs = await apiService.getPipelineRuns(owner, name);
      setPipelineRuns(selectedRepo, runs);
    } catch (error) {
      console.error('Failed to refresh pipeline:', error);
    } finally {
      setLoading('pipeline-refresh', false);
    }
  };

  const handleTriggerTest = async () => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.split('/');
    try {
      await apiService.triggerTestPush(owner, name);
    } catch (error) {
      console.error('Failed to trigger test:', error);
    }
  };

  const displayRepo = selectedRepo || repositories[0]?.fullName;
  const currentRuns = displayRepo ? pipelineRuns.get(displayRepo) || [] : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-display mb-1">流水线视图</h1>
          <p className="text-gray-400">实时追踪构建、测试、部署各阶段执行状态</p>
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
            disabled={isLoading('pipeline-refresh')}
            className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-bg-tertiary/50 rounded-lg text-white hover:border-brand-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading('pipeline-refresh') && 'animate-spin')} />
            刷新
          </button>
          <button
            onClick={handleTriggerTest}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-lg text-white font-medium hover:shadow-glow transition-all"
          >
            <Play className="w-4 h-4" />
            触发测试流水线
          </button>
        </div>
      </div>

      {isLoading('pipeline') ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {currentRuns.map((run) => (
            <PipelineRunCard
              key={run.id}
              run={run}
              isExpanded={expandedRuns.has(run.id)}
              onToggle={() => toggleRun(run.id)}
            />
          ))}

          {currentRuns.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无流水线运行记录</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Pipeline;
