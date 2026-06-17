import React, { useState } from 'react';
import {
  GitPullRequest,
  User,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Code2,
  GitMerge,
} from 'lucide-react';
import type { PullRequest, Review } from '../../shared/types.js';
import { StatusBadge } from './StatusBadge.js';
import { cn } from '../lib/utils.js';
import { formatDistanceToNow } from '../utils/date.js';

interface PRCardProps {
  pr: PullRequest;
  className?: string;
  style?: React.CSSProperties;
}

const getCIStatusColor = (state: string) => {
  switch (state) {
    case 'success':
      return 'bg-status-success';
    case 'failure':
      return 'bg-status-failure';
    case 'running':
      return 'bg-status-running';
    default:
      return 'bg-status-pending';
  }
};

const getReviewSummary = (reviews: Review[]) => {
  const approved = reviews.filter((r) => r.state === 'approved').length;
  const changesRequested = reviews.filter((r) => r.state === 'changes_requested').length;
  const commented = reviews.filter((r) => r.state === 'commented').length;

  return { approved, changesRequested, commented, total: reviews.length };
};

export const PRCard: React.FC<PRCardProps> = ({ pr, className, style }) => {
  const [expanded, setExpanded] = useState(false);
  const reviewSummary = getReviewSummary(pr.reviews);
  const ciProgress = pr.ciStatus.totalChecks > 0
    ? ((pr.ciStatus.passedChecks + pr.ciStatus.failedChecks) / pr.ciStatus.totalChecks) * 100
    : 0;

  return (
    <div
      className={cn(
        'card card-hover glow-border animate-fade-in overflow-hidden',
        className
      )}
      style={style}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={pr.state} size="sm" />
              <span className="text-xs text-gray-400 font-mono">
                #{pr.number}
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(pr.updatedAt)}
              </span>
            </div>

            <h3 className="font-display font-semibold text-white mb-2 line-clamp-2 hover:text-brand-primary transition-colors">
              {pr.title}
            </h3>

            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1.5">
                <img
                  src={pr.user.avatarUrl}
                  alt={pr.user.login}
                  className="w-5 h-5 rounded-full"
                />
                <span className="truncate max-w-[120px]">{pr.user.login}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <GitMerge className="w-4 h-4" />
                <span className="text-xs">
                  <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-brand-secondary">
                    {pr.head.ref}
                  </code>
                  <span className="mx-1">→</span>
                  <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-gray-400">
                    {pr.base.ref}
                  </code>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={pr.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-bg-tertiary/30 text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-bg-tertiary/30 text-gray-400 hover:text-white transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400 flex items-center gap-1">
                <Code2 className="w-3 h-3" />
                CI 检查
              </span>
              <span className="text-gray-300">
                {pr.ciStatus.passedChecks}/{pr.ciStatus.totalChecks} 通过
                {pr.ciStatus.failedChecks > 0 && (
                  <span className="text-status-failure ml-2">
                    {pr.ciStatus.failedChecks} 失败
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  getCIStatusColor(pr.ciStatus.state),
                  pr.ciStatus.state === 'running' && 'animate-progress'
                )}
                style={{ width: `${ciProgress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {reviewSummary.approved > 0 && (
              <div className="flex items-center gap-1 text-status-success text-xs" title={`${reviewSummary.approved} 人批准`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>{reviewSummary.approved}</span>
              </div>
            )}
            {reviewSummary.changesRequested > 0 && (
              <div className="flex items-center gap-1 text-status-failure text-xs" title={`${reviewSummary.changesRequested} 人请求变更`}>
                <XCircle className="w-4 h-4" />
                <span>{reviewSummary.changesRequested}</span>
              </div>
            )}
            {reviewSummary.commented > 0 && (
              <div className="flex items-center gap-1 text-gray-400 text-xs" title={`${reviewSummary.commented} 条评论`}>
                <MessageSquare className="w-4 h-4" />
                <span>{reviewSummary.commented}</span>
              </div>
            )}
            {reviewSummary.total === 0 && (
              <div className="flex items-center gap-1 text-gray-500 text-xs" title="等待审查">
                <Clock className="w-4 h-4" />
                <span>待审查</span>
              </div>
            )}
          </div>

          <div className="flex -space-x-2">
            {pr.reviews.slice(0, 3).map((review) => (
              <img
                key={review.id}
                src={review.user.avatarUrl}
                alt={review.user.login}
                className="w-6 h-6 rounded-full border-2 border-bg-card"
                title={`${review.user.login}: ${review.state}`}
              />
            ))}
            {pr.reviews.length > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-bg-card bg-bg-tertiary flex items-center justify-center text-[10px] text-gray-400">
                +{pr.reviews.length - 3}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-bg-tertiary/50 animate-slide-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  CI 检查详情
                </h4>
                <div className="space-y-1.5">
                  {pr.ciStatus.checks.map((check) => (
                    <div
                      key={check.id}
                      className="flex items-center justify-between text-sm bg-bg-tertiary/30 rounded-lg px-3 py-2"
                    >
                      <span className="text-gray-300">{check.name}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={
                            check.status === 'completed'
                              ? check.conclusion === 'success'
                                ? 'success'
                                : 'failure'
                              : check.status === 'in_progress'
                              ? 'running'
                              : 'pending'
                          }
                          size="sm"
                          showIcon={false}
                        />
                        {check.durationSeconds && (
                          <span className="text-xs text-gray-500">
                            {check.durationSeconds}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  代码审查意见
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {pr.reviews.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">暂无审查意见</p>
                  ) : (
                    pr.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="bg-bg-tertiary/30 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <img
                            src={review.user.avatarUrl}
                            alt={review.user.login}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-sm text-gray-300">
                            {review.user.login}
                          </span>
                          <StatusBadge
                            status={
                              review.state === 'approved'
                                ? 'success'
                                : review.state === 'changes_requested'
                                ? 'failure'
                                : 'pending'
                            }
                            text={
                              review.state === 'approved'
                                ? '批准'
                                : review.state === 'changes_requested'
                                ? '请求变更'
                                : '评论'
                            }
                            size="sm"
                            showIcon={false}
                          />
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {review.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PRCard;
