import crypto from 'crypto';
import db from '../db/database.js';
import { broadcastPRUpdate, broadcastPipelineUpdate } from './websocket.js';
import type { PullRequest, PipelineRun, PipelineStage, PipelineStep } from '../../shared/types.js';

interface WebhookEvent {
  event: string;
  payload: any;
}

export const verifySignature = (payload: string, signatureHeader: string, secret: string): boolean => {
  try {
    if (!payload || typeof payload !== 'string') return false;
    if (!signatureHeader || typeof signatureHeader !== 'string' || signatureHeader.length < 8) return false;
    if (!secret || typeof secret !== 'string') return false;

    const hmac = crypto.createHmac('sha256', secret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;

    const digestBuf = Buffer.from(digest);
    const sigBuf = Buffer.from(signatureHeader);

    if (digestBuf.length !== sigBuf.length) return false;

    return crypto.timingSafeEqual(digestBuf, sigBuf);
  } catch (error) {
    console.error('[Webhook] Signature verification error:', error);
    return false;
  }
};

export const handlePullRequestEvent = async (payload: any): Promise<PullRequest | null> => {
  const { action, pull_request, repository } = payload;

  if (!pull_request || !repository) return null;

  const repoFullName = repository.full_name;
  const repo = db.getRepositoryByFullName(repoFullName);
  if (!repo) return null;

  const pr = payload.pull_request;

  const ciStatus = await getCIStatusForPR(repoFullName, pr.number);
  const reviews = await getReviewsForPR(repoFullName, pr.number);

  const prData: PullRequest = {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    state: pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
    htmlUrl: pr.html_url,
    user: {
      id: pr.user.id,
      login: pr.user.login,
      avatarUrl: pr.user.avatar_url,
      htmlUrl: pr.user.html_url
    },
    base: {
      ref: pr.base.ref,
      sha: pr.base.sha
    },
    head: {
      ref: pr.head.ref,
      sha: pr.head.sha
    },
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
    mergeable: pr.mergeable,
    ciStatus,
    reviews,
    repoFullName
  };

  const savedPR = db.upsertPullRequest(prData);
  broadcastPRUpdate(savedPR);

  return savedPR;
};

export const handlePushEvent = async (payload: any): Promise<PipelineRun | null> => {
  const { repository, ref, after, head_commit, pusher } = payload;

  if (!repository || !ref) return null;

  const repoFullName = repository.full_name;
  const repo = db.getRepositoryByFullName(repoFullName);
  if (!repo) return null;

  const branch = ref.replace('refs/heads/', '');
  const commitSha = after;
  const commitMessage = head_commit?.message || 'Push event';

  const stages: PipelineStage[] = ['build', 'test', 'deploy'].map((stageName, idx) => ({
    id: `${Date.now()}-${stageName}`,
    name: stageName as 'build' | 'test' | 'deploy',
    status: idx === 0 ? 'running' : 'pending',
    startedAt: idx === 0 ? new Date().toISOString() : null,
    completedAt: null,
    durationSeconds: null,
    steps: generateStepsForStage(stageName as 'build' | 'test' | 'deploy')
  }));

  const pipelineRun: PipelineRun = {
    id: db.getNextId(),
    repoId: repo.id,
    repoFullName,
    commitSha,
    branch,
    trigger: 'push',
    createdAt: new Date().toISOString(),
    stages
  };

  const savedPipeline = db.upsertPipelineRun(pipelineRun);
  broadcastPipelineUpdate(savedPipeline);

  simulatePipelineProgress(savedPipeline);

  return savedPipeline;
};

export const handleWorkflowRunEvent = async (payload: any): Promise<any> => {
  const { action, workflow_run, repository } = payload;

  if (!workflow_run || !repository) return null;

  const repoFullName = repository.full_name;

  const run = {
    id: workflow_run.id,
    name: workflow_run.name,
    status: workflow_run.status,
    conclusion: workflow_run.conclusion,
    htmlUrl: workflow_run.html_url,
    createdAt: workflow_run.created_at,
    updatedAt: workflow_run.updated_at,
    repoFullName
  };

  const savedRun = db.upsertWorkflowRun(run);

  return savedRun;
};

export const handleCheckRunEvent = async (payload: any): Promise<any> => {
  const { action, check_run, repository } = payload;

  if (!check_run || !repository) return null;

  const repoFullName = repository.full_name;
  const prNumber = check_run.pull_requests?.[0]?.number;

  if (prNumber) {
    const pr = db.getPullRequestByNumber(repoFullName, prNumber);
    if (pr) {
      const existingCheckIdx = pr.ciStatus.checks.findIndex(c => c.id === check_run.id);
      const checkData = {
        id: check_run.id,
        name: check_run.name,
        status: check_run.status,
        conclusion: check_run.conclusion,
        startedAt: check_run.started_at,
        completedAt: check_run.completed_at,
        durationSeconds: check_run.started_at && check_run.completed_at
          ? Math.floor((new Date(check_run.completed_at).getTime() - new Date(check_run.started_at).getTime()) / 1000)
          : null
      };

      if (existingCheckIdx >= 0) {
        pr.ciStatus.checks[existingCheckIdx] = checkData;
      } else {
        pr.ciStatus.checks.push(checkData);
      }

      const passed = pr.ciStatus.checks.filter(c => c.conclusion === 'success').length;
      const failed = pr.ciStatus.checks.filter(c => c.conclusion === 'failure').length;
      const running = pr.ciStatus.checks.filter(c => c.status === 'in_progress' || c.status === 'queued').length;

      if (running > 0) pr.ciStatus.state = 'running';
      else if (failed > 0) pr.ciStatus.state = 'failure';
      else if (passed === pr.ciStatus.checks.length) pr.ciStatus.state = 'success';

      pr.ciStatus.passedChecks = passed;
      pr.ciStatus.failedChecks = failed;
      pr.ciStatus.totalChecks = pr.ciStatus.checks.length;

      const savedPR = db.upsertPullRequest(pr);
      broadcastPRUpdate(savedPR);

      return savedPR;
    }
  }

  return null;
};

export const handleReviewEvent = async (payload: any): Promise<any> => {
  const { action, review, pull_request, repository } = payload;

  if (!review || !pull_request || !repository) return null;

  const repoFullName = repository.full_name;
  const prNumber = pull_request.number;

  const pr = db.getPullRequestByNumber(repoFullName, prNumber);
  if (pr) {
    const existingReviewIdx = pr.reviews.findIndex(r => r.id === review.id);
    const reviewData = {
      id: review.id,
      user: {
        id: review.user.id,
        login: review.user.login,
        avatarUrl: review.user.avatar_url,
        htmlUrl: review.user.html_url
      },
      state: review.state.toLowerCase(),
      body: review.body || '',
      submittedAt: review.submitted_at
    };

    if (existingReviewIdx >= 0) {
      pr.reviews[existingReviewIdx] = reviewData;
    } else {
      pr.reviews.push(reviewData);
    }

    const savedPR = db.upsertPullRequest(pr);
    broadcastPRUpdate(savedPR);

    return savedPR;
  }

  return null;
};

const getCIStatusForPR = async (repoFullName: string, prNumber: number) => {
  return {
    state: 'success' as const,
    totalChecks: 5,
    passedChecks: 4,
    failedChecks: 1,
    checks: []
  };
};

const getReviewsForPR = async (repoFullName: string, prNumber: number) => {
  return [];
};

const generateStepsForStage = (stageName: 'build' | 'test' | 'deploy'): PipelineStep[] => {
  const stepNames = {
    build: ['Checkout代码', '安装依赖', '类型检查', '编译构建', '打包产物'],
    test: ['单元测试', '集成测试', 'E2E测试', '性能测试', '安全扫描'],
    deploy: ['构建镜像', '推送镜像仓库', '部署到Staging', '冒烟测试', '部署到Production']
  };

  return stepNames[stageName].map((name, i) => ({
    id: `${stageName}-step-${i}`,
    name,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
    logSummary: null
  }));
};

const simulatePipelineProgress = async (pipeline: PipelineRun) => {
  for (let stageIdx = 0; stageIdx < pipeline.stages.length; stageIdx++) {
    const stage = pipeline.stages[stageIdx];

    await delay(1000);
    stage.status = 'running';
    stage.startedAt = new Date().toISOString();
    broadcastPipelineUpdate(db.upsertPipelineRun(pipeline));

    for (let stepIdx = 0; stepIdx < stage.steps.length; stepIdx++) {
      const step = stage.steps[stepIdx];
      await delay(800);
      step.status = 'running';
      step.startedAt = new Date().toISOString();
      step.logSummary = `正在执行: ${step.name}...`;
      broadcastPipelineUpdate(db.upsertPipelineRun(pipeline));

      await delay(Math.random() * 2000 + 1000);
      step.status = Math.random() > 0.1 ? 'success' : 'failed';
      step.completedAt = new Date().toISOString();
      step.durationSeconds = step.startedAt
        ? Math.floor((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000)
        : null;
      step.logSummary = step.status === 'success'
        ? `${step.name} 执行成功，耗时 ${step.durationSeconds}s`
        : `${step.name} 执行失败，请检查日志`;

      broadcastPipelineUpdate(db.upsertPipelineRun(pipeline));

      if (step.status === 'failed') {
        stage.status = 'failed';
        stage.completedAt = new Date().toISOString();
        stage.durationSeconds = stage.startedAt
          ? Math.floor((new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime()) / 1000)
          : null;
        broadcastPipelineUpdate(db.upsertPipelineRun(pipeline));
        return;
      }
    }

    stage.status = 'success';
    stage.completedAt = new Date().toISOString();
    stage.durationSeconds = stage.startedAt
      ? Math.floor((new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime()) / 1000)
      : null;
    broadcastPipelineUpdate(db.upsertPipelineRun(pipeline));
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const processWebhook = async (event: string, payload: any): Promise<any> => {
  console.log(`[Webhook] Processing event: ${event}`);

  switch (event) {
    case 'pull_request':
      return handlePullRequestEvent(payload);
    case 'push':
      return handlePushEvent(payload);
    case 'workflow_run':
      return handleWorkflowRunEvent(payload);
    case 'check_run':
      return handleCheckRunEvent(payload);
    case 'pull_request_review':
      return handleReviewEvent(payload);
    default:
      console.log(`[Webhook] Unhandled event type: ${event}`);
      return null;
  }
};
