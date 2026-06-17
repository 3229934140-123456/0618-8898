export interface Repository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface CheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface CIStatus {
  state: 'pending' | 'success' | 'failure' | 'running';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: CheckRun[];
}

export interface Review {
  id: number;
  user: GitHubUser;
  state: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
  body: string;
  submittedAt: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  htmlUrl: string;
  user: GitHubUser;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  mergeable: boolean | null;
  ciStatus: CIStatus;
  reviews: Review[];
  repoFullName: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  logSummary: string | null;
}

export interface PipelineStage {
  id: string;
  name: 'build' | 'test' | 'deploy';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  steps: PipelineStep[];
}

export interface PipelineRun {
  id: number;
  repoId: number;
  repoFullName: string;
  commitSha: string;
  branch: string;
  trigger: string;
  createdAt: string;
  stages: PipelineStage[];
}

export interface CoverageData {
  id: number;
  repoId: number;
  repoFullName: string;
  branch: string;
  commitSha: string;
  coveragePercent: number;
  linesCovered: number;
  linesTotal: number;
  createdAt: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled';
  htmlUrl: string;
  badgeUrl: string;
  lastRun: WorkflowRun | null;
}

export interface DeploymentStats {
  repoId: number;
  repoName: string;
  period: string;
  deploymentCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationSeconds: number;
}

export type WSEvent =
  | { type: 'pr:updated'; data: PullRequest }
  | { type: 'pipeline:updated'; data: PipelineRun }
  | { type: 'workflow:updated'; data: WorkflowRun & { repoFullName: string } }
  | { type: 'deployment:completed'; data: DeploymentStats };

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DateRange {
  start: string;
  end: string;
}
