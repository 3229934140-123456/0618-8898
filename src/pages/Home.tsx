import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Zap,
  Activity,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore.js';
import { apiService } from '../services/api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { PRCard } from '../components/PRCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { cn } from '../lib/utils.js';
import type { Repository, PullRequest } from '../../shared/types.js';

const Home: React.FC = () => {
  const {
    repositories,
    pullRequests,
    selectedRepo,
    setRepositories,
    setPullRequests,
    setSelectedRepo,
    setLoading,
    isLoading,
    setError,
  } = useDashboardStore();

  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useWebSocket();

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    if (repositories.length > 0) {
      repositories.forEach((repo) => {
        loadPullRequests(repo.owner, repo.name);
      });
      setExpandedRepos(new Set(repositories.map((r) => r.fullName)));
    }
  }, [repositories]);

  const loadRepositories = async () => {
    try {
      setLoading('repos', true);
      const repos = await apiService.getRepositories();
      setRepositories(repos);
    } catch (error) {
      setError('repos', (error as Error).message);
    } finally {
      setLoading('repos', false);
    }
  };

  const loadPullRequests = async (owner: string, repo: string) => {
    try {
      setLoading(`prs-${owner}/${repo}`, true);
      const prs = await apiService.getPullRequests(owner, repo);
      setPullRequests(`${owner}/${repo}`, prs);
    } catch (error) {
      setError(`prs-${owner}/${repo}`, (error as Error).message);
    } finally {
      setLoading(`prs-${owner}/${repo}`, false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRepositories();
    setRefreshing(false);
  };

  const toggleRepo = (repoFullName: string) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repoFullName)) {
      newExpanded.delete(repoFullName);
    } else {
      newExpanded.add(repoFullName);
    }
    setExpandedRepos(newExpanded);
  };

  const triggerTestPipeline = async (repo: Repository) => {
    try {
      await apiService.triggerTestPush(repo.owner, repo.name);
    } catch (error) {
      console.error('Failed to trigger test pipeline:', error);
    }
  };

  const getRepoStats = (repoFullName: string) => {
    const prs = pullRequests.get(repoFullName) || [];
    const openPRs = prs.filter((p) => p.state === 'open');
    const mergedPRs = prs.filter((p) => p.state === 'merged');
    const failedCI = prs.filter(
      (p) => p.ciStatus.state === 'failure' && p.state === 'open'
    );
    const runningCI = prs.filter(
      (p) => p.ciStatus.state === 'running' && p.state === 'open'
    );

    return { total: prs.length, open: openPRs.length, merged: mergedPRs.length, failedCI: failedCI.length, runningCI: runningCI.length };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-brand-primary" />
            开发流水线看板
          </h1>
          <p className="text-gray-400">实时监控所有仓库的 PR 状态和 CI/CD 流水线</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className={cn(
              'btn-outline flex items-center gap-2',
              refreshing && 'animate-spin'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: '总仓库数',
            value: repositories.length,
            icon: <GitBranch className="w-5 h-5" />,
            color: 'text-brand-primary',
            bgColor: 'bg-brand-primary/10',
          },
          {
            label: '活跃 PR',
            value: Array.from(pullRequests.values()).flat().filter((p) => p.state === 'open').length,
            icon: <GitPullRequest className="w-5 h-5" />,
            color: 'text-status-running',
            bgColor: 'bg-status-running/10',
          },
          {
            label: 'CI 运行中',
            value: Array.from(pullRequests.values()).flat().filter((p) => p.ciStatus.state === 'running').length,
            icon: <Zap className="w-5 h-5" />,
            color: 'text-status-running',
            bgColor: 'bg-status-running/10',
          },
          {
            label: 'CI 失败',
            value: Array.from(pullRequests.values()).flat().filter((p) => p.ciStatus.state === 'failure' && p.state === 'open').length,
            icon: <AlertCircle className="w-5 h-5" />,
            color: 'text-status-failure',
            bgColor: 'bg-status-failure/10',
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="card p-4 animate-fade-in"
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', stat.bgColor, stat.color)}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading('repos') ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
          </div>
        ) : (
          repositories.map((repo, repoIdx) => {
            const stats = getRepoStats(repo.fullName);
            const prs = pullRequests.get(repo.fullName) || [];
            const isExpanded = expandedRepos.has(repo.fullName);
            const loadingKey = `prs-${repo.owner}/${repo.name}`;

            return (
              <div
                key={repo.id}
                className="card overflow-hidden animate-fade-in"
                style={{ animationDelay: `${(repoIdx + 4) * 0.1}s` }}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-bg-tertiary/20 transition-colors"
                  onClick={() => toggleRepo(repo.fullName)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="text-gray-400 hover:text-white transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center">
                        <GitBranch className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <h2 className="font-display font-semibold text-white text-lg">
                          {repo.fullName}
                        </h2>
                        <p className="text-sm text-gray-400">{repo.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <GitPullRequest className="w-4 h-4" />
                          <span>{stats.open} 进行中</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-status-success">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{stats.merged} 已合并</span>
                        </div>
                        {stats.runningCI > 0 && (
                          <div className="flex items-center gap-1.5 text-status-running">
                            <Zap className="w-4 h-4" />
                            <span>{stats.runningCI} 运行中</span>
                          </div>
                        )}
                        {stats.failedCI > 0 && (
                          <div className="flex items-center gap-1.5 text-status-failure">
                            <XCircle className="w-4 h-4" />
                            <span>{stats.failedCI} 失败</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerTestPipeline(repo);
                        }}
                        className="btn-outline text-xs flex items-center gap-1"
                        title="触发测试流水线"
                      >
                        <Zap className="w-3 h-3" />
                        触发
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-bg-tertiary/50 p-4 animate-slide-in">
                    {isLoading(loadingKey) ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
                      </div>
                    ) : prs.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <GitPullRequest className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>暂无 Pull Request</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {prs.map((pr, prIdx) => (
                          <PRCard
                            key={pr.id}
                            pr={pr}
                            className="animate-slide-in"
                            style={{ animationDelay: `${prIdx * 0.05}s` } as React.CSSProperties}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Home;
