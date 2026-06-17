import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Zap,
  Target,
  Activity,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { apiService } from '@/services/api';
import { formatDuration } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { DeploymentStats } from '../../shared/types.js';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  subValue?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  subValue,
  color = 'bg-brand-primary/20 text-brand-primary',
}) => {
  return (
    <div className="bg-bg-secondary rounded-xl border border-bg-tertiary/50 p-5 hover:border-brand-primary/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-white font-mono mb-1">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  );
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-secondary border border-bg-tertiary/50 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-300">{entry.name}:</span>
            <span className="text-white font-mono font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const Statistics: React.FC = () => {
  const {
    repositories,
    deploymentStats,
    successRateStats,
    selectedRepo,
    setRepositories,
    setDeploymentStats,
    setSuccessRateStats,
    setSelectedRepo,
    setLoading,
    isLoading,
  } = useDashboardStore();

  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('week');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  useEffect(() => {
    const loadRepos = async () => {
      try {
        const repos = await apiService.getRepositories();
        setRepositories(repos);
      } catch (error) {
        console.error('Failed to load repositories:', error);
      }
    };
    loadRepos();
  }, [setRepositories]);

  useEffect(() => {
    const loadData = async () => {
      setLoading('statistics', true);
      try {
        const [deployStats, rateStats] = await Promise.all([
          apiService.getDeploymentStats(selectedRepo || undefined, period),
          apiService.getSuccessRate(selectedRepo || undefined, period),
        ]);
        setDeploymentStats(deployStats);
        setSuccessRateStats(rateStats);
      } catch (error) {
        console.error('Failed to load statistics:', error);
      } finally {
        setLoading('statistics', false);
      }
    };

    if (repositories.length > 0) {
      loadData();
    }
  }, [selectedRepo, period, repositories.length, setDeploymentStats, setSuccessRateStats, setLoading]);

  const chartData = useMemo(() => {
    const seenPeriods = new Set<string>();
    return deploymentStats
      .filter((s) => {
        if (seenPeriods.has(s.period)) return false;
        seenPeriods.add(s.period);
        return true;
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [deploymentStats]);

  const summaryStats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        totalDeployments: 0,
        totalSuccess: 0,
        totalFailure: 0,
        avgSuccessRate: 0,
        avgDuration: 0,
        deploymentsPerDay: 0,
      };
    }

    const totalDeployments = chartData.reduce((acc, s) => acc + s.deploymentCount, 0);
    const totalSuccess = chartData.reduce((acc, s) => acc + s.successCount, 0);
    const totalFailure = chartData.reduce((acc, s) => acc + s.failureCount, 0);
    const avgSuccessRate = chartData.reduce((acc, s) => acc + s.successRate, 0) / chartData.length;
    const avgDuration = chartData.reduce((acc, s) => acc + s.averageDurationSeconds, 0) / chartData.length;

    let daysInPeriod = 7;
    switch (period) {
      case 'week': daysInPeriod = 7; break;
      case 'month': daysInPeriod = 30; break;
      case 'quarter': daysInPeriod = 91; break;
      case 'year': daysInPeriod = 365; break;
    }
    const deploymentsPerDay = totalDeployments / daysInPeriod;

    return {
      totalDeployments,
      totalSuccess,
      totalFailure,
      avgSuccessRate,
      avgDuration,
      deploymentsPerDay,
    };
  }, [chartData, period]);

  const pieData = useMemo(() => {
    if (summaryStats.totalDeployments === 0) return [];
    return [
      { name: '成功', value: summaryStats.totalSuccess, color: '#10b981' },
      { name: '失败', value: summaryStats.totalFailure, color: '#ef4444' },
    ];
  }, [summaryStats]);

  const deploymentChartData = useMemo(() => {
    return chartData.map((s) => ({
      date: s.period,
      部署次数: s.deploymentCount,
      成功: s.successCount,
      失败: s.failureCount,
    }));
  }, [chartData]);

  const successRateChartData = useMemo(() => {
    return chartData.map((s) => ({
      date: s.period,
      成功率: s.successRate,
    }));
  }, [chartData]);

  const handleRefresh = async () => {
    setLoading('statistics-refresh', true);
    try {
      const [deployStats, rateStats] = await Promise.all([
        apiService.getDeploymentStats(selectedRepo || undefined, period),
        apiService.getSuccessRate(selectedRepo || undefined, period),
      ]);
      setDeploymentStats(deployStats);
      setSuccessRateStats(rateStats);
    } catch (error) {
      console.error('Failed to refresh statistics:', error);
    } finally {
      setLoading('statistics-refresh', false);
    }
  };

  const periodOptions = [
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'quarter', label: '本季度' },
    { value: 'year', label: '本年' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-display mb-1">统计分析</h1>
          <p className="text-gray-400">按仓库和时间范围分析部署频率和成功率</p>
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
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="bg-bg-secondary border border-bg-tertiary/50 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={isLoading('statistics-refresh')}
            className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-bg-tertiary/50 rounded-lg text-white hover:border-brand-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading('statistics-refresh') && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {isLoading('statistics') ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              label="总部署次数"
              value={summaryStats.totalDeployments.toString()}
              icon={<Zap className="w-5 h-5 text-white" />}
              color="bg-brand-primary/20 text-brand-primary"
            />
            <StatCard
              label="成功次数"
              value={summaryStats.totalSuccess.toString()}
              icon={<CheckCircle2 className="w-5 h-5 text-white" />}
              color="bg-status-success/20 text-status-success"
            />
            <StatCard
              label="失败次数"
              value={summaryStats.totalFailure.toString()}
              icon={<XCircle className="w-5 h-5 text-white" />}
              color="bg-status-failure/20 text-status-failure"
            />
            <StatCard
              label="平均成功率"
              value={`${summaryStats.avgSuccessRate.toFixed(1)}%`}
              icon={<Target className="w-5 h-5 text-white" />}
              subValue={`目标 95%`}
              color={cn(
                summaryStats.avgSuccessRate >= 95
                  ? 'bg-status-success/20 text-status-success'
                  : summaryStats.avgSuccessRate >= 85
                  ? 'bg-status-running/20 text-status-running'
                  : 'bg-status-failure/20 text-status-failure'
              )}
            />
            <StatCard
              label="日均部署"
              value={summaryStats.deploymentsPerDay.toFixed(1)}
              icon={<Activity className="w-5 h-5 text-white" />}
              color="bg-purple-500/20 text-purple-400"
            />
            <StatCard
              label="平均耗时"
              value={formatDuration(summaryStats.avgDuration)}
              icon={<Clock className="w-5 h-5 text-white" />}
              color="bg-blue-500/20 text-blue-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-white">部署趋势</h2>
                  <div className="flex bg-bg-tertiary/30 rounded-lg p-0.5">
                    <button
                      onClick={() => setChartType('bar')}
                      className={cn(
                        'px-3 py-1 rounded-md text-sm transition-colors',
                        chartType === 'bar'
                          ? 'bg-brand-primary text-white'
                          : 'text-gray-400 hover:text-white'
                      )}
                    >
                      柱状图
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
              </div>

              <div className="h-80">
                {deploymentChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={deploymentChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                        />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Legend
                          wrapperStyle={{ paddingTop: '20px' }}
                          formatter={(value) => (
                            <span className="text-gray-300 text-sm">{value}</span>
                          )}
                        />
                        <Bar dataKey="成功" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="失败" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : (
                      <LineChart data={deploymentChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                        />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Legend
                          wrapperStyle={{ paddingTop: '20px' }}
                          formatter={(value) => (
                            <span className="text-gray-300 text-sm">{value}</span>
                          )}
                        />
                        <Line
                          type="monotone"
                          dataKey="部署次数"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无部署数据</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4">部署结果分布</h2>
                <div className="h-56">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <p>暂无数据</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-center gap-6 mt-2">
                  {pieData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-300">
                        {item.name}: {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4">成功率趋势</h2>
                <div className="h-48">
                  {successRateChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={successRateChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 10 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 10 }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`${value.toFixed(2)}%`, '成功率']}
                        />
                        <Line
                          type="monotone"
                          dataKey="成功率"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>暂无数据</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
            <h2 className="text-lg font-bold text-white mb-4">详细统计数据</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bg-tertiary/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                      周期
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                      仓库
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">
                      部署次数
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">
                      成功
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">
                      失败
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">
                      成功率
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">
                      平均耗时
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deploymentStats.map((stat, index) => (
                    <tr
                      key={index}
                      className="border-b border-bg-tertiary/30 hover:bg-bg-tertiary/20 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-white">{stat.period}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {stat.repoName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-mono font-bold text-white">
                          {stat.deploymentCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-mono font-bold text-status-success">
                          {stat.successCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-mono font-bold text-status-failure">
                          {stat.failureCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={cn(
                            'text-sm font-mono font-bold',
                            stat.successRate >= 95
                              ? 'text-status-success'
                              : stat.successRate >= 85
                              ? 'text-status-running'
                              : 'text-status-failure'
                          )}
                        >
                          {stat.successRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-mono text-gray-300">
                          {formatDuration(stat.averageDurationSeconds)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Statistics;
