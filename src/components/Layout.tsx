import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  LineChart,
  PlayCircle,
  BarChart3,
  Settings,
  Zap,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore.js';
import { cn } from '../lib/utils.js';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/', label: '看板主页', icon: <LayoutDashboard className="w-5 h-5" /> },
  { path: '/pipeline', label: '流水线视图', icon: <GitBranch className="w-5 h-5" /> },
  { path: '/coverage', label: '覆盖率趋势', icon: <LineChart className="w-5 h-5" /> },
  { path: '/workflows', label: '工作流触发', icon: <PlayCircle className="w-5 h-5" /> },
  { path: '/statistics', label: '统计分析', icon: <BarChart3 className="w-5 h-5" /> },
  { path: '/settings', label: '系统设置', icon: <Settings className="w-5 h-5" /> },
];

export const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { wsConnected } = useDashboardStore();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-bg-primary">
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-bg-secondary border-r border-bg-tertiary/50 z-50 transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-bg-tertiary/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center flex-shrink-0 shadow-glow">
                <Activity className="w-6 h-6 text-white" />
              </div>
              {!collapsed && (
                <div className="overflow-hidden">
                  <h1 className="font-display font-bold text-lg text-white truncate">PipelineFlow</h1>
                  <p className="text-xs text-gray-400 truncate">DevOps 可视化看板</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 py-4 overflow-y-auto">
            <ul className="space-y-1 px-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                        isActive
                          ? 'bg-brand-primary/20 text-brand-primary shadow-glow'
                          : 'text-gray-400 hover:text-white hover:bg-bg-tertiary/30'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 transition-transform',
                        isActive && 'scale-110'
                      )}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="font-medium text-sm">{item.label}</span>
                      )}
                      {!collapsed && isActive && (
                        <Zap className="w-4 h-4 ml-auto text-brand-primary" />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-bg-tertiary/50">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-3 h-3 rounded-full flex-shrink-0',
                wsConnected ? 'bg-status-success pulse-ring' : 'bg-status-failure'
              )} />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {wsConnected ? (
                      <Wifi className="w-4 h-4 text-status-success" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-status-failure" />
                    )}
                    <span className="text-xs font-medium">
                      {wsConnected ? '实时连接' : '连接断开'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-20 w-6 h-6 bg-bg-tertiary rounded-full border border-bg-tertiary/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-primary transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      <main
        className={cn(
          'flex-1 transition-all duration-300 min-h-screen',
          collapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
