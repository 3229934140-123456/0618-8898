import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, Ban } from 'lucide-react';
import { cn } from '../lib/utils.js';

type StatusType = 'success' | 'failure' | 'running' | 'pending' | 'skipped' | 'merged' | 'open' | 'closed';

interface StatusBadgeProps {
  status: StatusType;
  text?: string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<StatusType, {
  icon: React.ReactNode;
  className: string;
  defaultText: string;
}> = {
  success: {
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: 'status-success',
    defaultText: '成功',
  },
  failure: {
    icon: <XCircle className="w-3 h-3" />,
    className: 'status-failure',
    defaultText: '失败',
  },
  running: {
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    className: 'status-running',
    defaultText: '运行中',
  },
  pending: {
    icon: <Clock className="w-3 h-3" />,
    className: 'status-pending',
    defaultText: '等待中',
  },
  skipped: {
    icon: <Ban className="w-3 h-3" />,
    className: 'status-skipped',
    defaultText: '已跳过',
  },
  merged: {
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: 'status-success',
    defaultText: '已合并',
  },
  open: {
    icon: <Loader2 className="w-3 h-3" />,
    className: 'status-running',
    defaultText: '进行中',
  },
  closed: {
    icon: <XCircle className="w-3 h-3" />,
    className: 'status-pending',
    defaultText: '已关闭',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  text,
  className,
  showIcon = true,
  size = 'md',
}) => {
  const config = statusConfig[status] || statusConfig.pending;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <span className={cn(config.className, sizeClasses[size], className)}>
      {showIcon && <span className={status === 'running' ? 'animate-spin' : ''}>{config.icon}</span>}
      {text || config.defaultText}
    </span>
  );
};

export default StatusBadge;
