import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Brush,
} from 'recharts';
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  GitBranch,
  Loader2,
  RefreshCw,
  Target,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { apiService } from '@/services/api';
import { formatShortDate, formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { CoverageData } from '../../shared/types.js';

const branchColors: Record<string, { stroke: string; fill: string }> = {
  main: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.2)' },
  develop: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.2)' },
  'feature/auth': { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.2)' },
  'feature/new-ui': { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' },
};

const getBranchColor = (branch: string) => {
  return branchColors[branch] || { stroke: '#6b7280', fill: 'rgba(107, 114, 128, 0.2)' };
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, color = 'text-brand-primary' }) => {
  return (
    <div className="bg-bg-secondary rounded-xl border border-bg-tertiary/50 p-5 hover:border-brand-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              trend >= 0
                ? 'bg-status-success/20 text-status-success'
                : 'bg-status-failure/20 text-status-failure'
            )}
          >
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(trend).toFixed(2)}%
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-white font-mono mb-1">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-secondary border border-bg-tertiary/50 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-white mb-2">{formatDate(label)}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-300">{entry.name}:</span>
            <span className="text-white font-mono font-medium">
              {entry.value.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const Coverage: React.FC = () => {
  const {
    repositories,
    coverageData,
    selectedRepo,
    setRepositories,
    setCoverageData,
    setSelectedRepo,
    setLoading,
    isLoading,
  } = useDashboardStore();

  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set(['main', 'develop']));
  const [chartType, setChartType] = useState<'line' | 'area'>('area');

  useEffect(() => {
    const loadData = async () => {
      setLoading('coverage', true);
      try {
        const repos = await apiService.getRepositories();
        setRepositories(repos);

        for (const repo of repos) {
          const [owner, name] = repo.fullName.split('/');
          const data = await apiService.getCoverageData(owner, name);
          setCoverageData(repo.fullName, data);
        }
      } catch (error) {
        console.error('Failed to load coverage data:', error);
      } finally {
        setLoading('coverage', false);
      }
    };

    loadData();
  }, [setRepositories, setCoverageData, setLoading]);

  const displayRepo = selectedRepo || repositories[0]?.fullName;
  const currentData = displayRepo ? coverageData.get(displayRepo) || [] : [];

  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    currentData.forEach((d) => branches.add(d.branch));
    return Array.from(branches);
  }, [currentData]);

  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, any>>();

    currentData
      .filter((d) => selectedBranches.has(d.branch))
      .forEach((d) => {
        const date = d.createdAt.split('T')[0];
        if (!dateMap.has(date)) {
          dateMap.set(date, { date: d.createdAt });
        }
        dateMap.get(date)![d.branch] = d.coveragePercent;
      });

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [currentData, selectedBranches]);

  const stats = useMemo(() => {
    const latestByBranch = new Map<string, CoverageData>();
    currentData.forEach((d) => {
      const existing = latestByBranch.get(d.branch);
      if (!existing || new Date(d.createdAt) > new Date(existing.createdAt)) {
        latestByBranch.set(d.branch, d);
      }
    });

    const mainLatest = latestByBranch.get('main');
    const latest = mainLatest || Array.from(latestByBranch.values())[0];

    if (!latest) {
      return { current: 0, avg: 0, trend: 0, linesCovered: 0, linesTotal: 0 };
    }

    const branchData = currentData.filter((d) => d.branch === latest.branch);
    const sorted = [...branchData].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const avg =
      branchData.reduce((acc, d) => acc + d.coveragePercent, 0) / branchData.length;

    const firstWeek = sorted.slice(0, 7);
    const lastWeek = sorted.slice(-7);
    const firstAvg =
      firstWeek.reduce((acc, d) => acc + d.coveragePercent, 0) / firstWeek.length;
    const lastAvg =
      lastWeek.reduce((acc, d) => acc + d.coveragePercent, 0) / lastWeek.length;
    const trend = lastAvg - firstAvg;

    return {
      current: latest.coveragePercent,
      avg,
      trend,
      linesCovered: latest.linesCovered,
      linesTotal: latest.linesTotal,
    };
  }, [currentData]);

  const toggleBranch = (branch: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branch)) {
        next.delete(branch);
      } else {
        next.add(branch);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.split('/');
    setLoading('coverage-refresh', true);
    try {
      const data = await apiService.getCoverageData(owner, name);
      setCoverageData(selectedRepo, data);
    } catch (error) {
      console.error('Failed to refresh coverage:', error);
    } finally {
      setLoading('coverage-refresh', false);
    }
  };

  const targetCoverage = 80;
  const coverageStatus = stats.current >= targetCoverage ? 'success' : stats.current >= 70 ? 'warning' : 'danger';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-display mb-1">覆盖率趋势</h1>
          <p className="text-gray-400">按分支追踪测试覆盖率历史变化</p>
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
            disabled={isLoading('coverage-refresh')}
            className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-bg-tertiary/50 rounded-lg text-white hover:border-brand-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading('coverage-refresh') && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {isLoading('coverage') ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="当前覆盖率"
              value={`${stats.current.toFixed(2)}%`}
              icon={<Target className="w-5 h-5 text-white" />}
              trend={stats.trend}
              color={cn(
                coverageStatus === 'success'
                  ? 'bg-status-success/20 text-status-success'
                  : coverageStatus === 'warning'
                  ? 'bg-status-running/20 text-status-running'
                  : 'bg-status-failure/20 text-status-failure'
              )}
            />
            <StatCard
              label="历史平均"
              value={`${stats.avg.toFixed(2)}%`}
              icon={<LineChartIcon className="w-5 h-5 text-white" />}
              color="bg-brand-primary/20 text-brand-primary"
            />
            <StatCard
              label="已覆盖行数"
              value={stats.linesCovered.toLocaleString()}
              icon={<CheckCircle2 className="w-5 h-5 text-white" />}
              color="bg-status-success/20 text-status-success"
            />
            <StatCard
              label="总行数"
              value={stats.linesTotal.toLocaleString()}
              icon={<FileCode className="w-5 h-5 text-white" />}
              color="bg-blue-500/20 text-blue-400"
            />
          </div>

          <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-white">覆盖率趋势图</h2>
                <div className="flex bg-bg-tertiary/30 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartType('area')}
                    className={cn(
                      'px-3 py-1 rounded-md text-sm transition-colors',
                      chartType === 'area'
                        ? 'bg-brand-primary text-white'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    面积图
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    className={cn(
                      'px-3 py-1 rounded-md text-sm transition-colors',
                      chartType === 'line'
                        ? 'bg-brand-primary text-white'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    折线图
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  分支:
                </span>
                {availableBranches.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => toggleBranch(branch)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                      selectedBranches.has(branch)
                        ? 'border-transparent text-white'
                        : 'border-bg-tertiary/50 text-gray-400 hover:text-white'
                    )}
                    style={{
                      backgroundColor: selectedBranches.has(branch)
                        ? getBranchColor(branch).stroke
                        : 'transparent',
                    }}
                  >
                    {branch}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-96">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={chartData}>
                      <defs>
                        {availableBranches
                          .filter((b) => selectedBranches.has(b))
                          .map((branch) => {
                            const color = getBranchColor(branch);
                            return (
                              <linearGradient
                                key={branch}
                                id={`color-${branch}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={color.stroke}
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={color.stroke}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            );
                          })}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => formatShortDate(v)}
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                      />
                      <YAxis
                        domain={[50, 100]}
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value) => (
                          <span className="text-gray-300 text-sm">{value}</span>
                        )}
                      />
                      {availableBranches
                        .filter((b) => selectedBranches.has(b))
                        .map((branch) => {
                          const color = getBranchColor(branch);
                          return (
                            <Area
                              key={branch}
                              type="monotone"
                              dataKey={branch}
                              stroke={color.stroke}
                              strokeWidth={2}
                              fill={`url(#color-${branch})`}
                              activeDot={{ r: 6 }}
                              dot={false}
                            />
                          );
                        })}
                      <Brush
                        dataKey="date"
                        height={30}
                        stroke="#3b82f6"
                        fill="#1f2937"
                        tickFormatter={(v) => formatShortDate(v)}
                      />
                    </AreaChart>
                  ) : (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => formatShortDate(v)}
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                      />
                      <YAxis
                        domain={[50, 100]}
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value) => (
                          <span className="text-gray-300 text-sm">{value}</span>
                        )}
                      />
                      {availableBranches
                        .filter((b) => selectedBranches.has(b))
                        .map((branch) => {
                          const color = getBranchColor(branch);
                          return (
                            <Line
                              key={branch}
                              type="monotone"
                              dataKey={branch}
                              stroke={color.stroke}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 6 }}
                            />
                          );
                        })}
                      <Brush
                        dataKey="date"
                        height={30}
                        stroke="#3b82f6"
                        fill="#1f2937"
                        tickFormatter={(v) => formatShortDate(v)}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <LineChartIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>请选择要展示的分支</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
            <h2 className="text-lg font-bold text-white mb-4">目标达成情况</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">目标覆盖率</span>
                  <span className="text-sm font-medium text-white">{targetCoverage}%</span>
                </div>
                <div className="h-3 bg-bg-tertiary/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      coverageStatus === 'success'
                        ? 'bg-gradient-to-r from-status-success to-status-success/70'
                        : coverageStatus === 'warning'
                        ? 'bg-gradient-to-r from-status-running to-status-running/70'
                        : 'bg-gradient-to-r from-status-failure to-status-failure/70'
                    )}
                    style={{ width: `${Math.min(stats.current, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {coverageStatus === 'success'
                    ? '🎉 已达成目标覆盖率！'
                    : coverageStatus === 'warning'
                    ? `📈 距离目标还差 ${(targetCoverage - stats.current).toFixed(2)}%，继续加油！`
                    : `⚠️ 距离目标还差 ${(targetCoverage - stats.current).toFixed(2)}%，需要提升测试覆盖。`}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Coverage;
