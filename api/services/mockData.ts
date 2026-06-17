import type {
  Repository,
  PullRequest,
  PipelineRun,
  CoverageData,
  Workflow,
  WorkflowRun,
  DeploymentStats,
  CheckRun,
  Review
} from '../../shared/types.js';

const users = [
  { id: 1, login: 'alice_dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice', htmlUrl: 'https://github.com/alice' },
  { id: 2, login: 'bob_engineer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob', htmlUrl: 'https://github.com/bob' },
  { id: 3, login: 'charlie_qa', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie', htmlUrl: 'https://github.com/charlie' },
  { id: 4, login: 'diana_design', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana', htmlUrl: 'https://github.com/diana' },
  { id: 5, login: 'evan_ops', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=evan', htmlUrl: 'https://github.com/evan' }
];

const repositories: Repository[] = [
  {
    id: 1,
    owner: 'trae',
    name: 'pipeline-dashboard',
    fullName: 'trae/pipeline-dashboard',
    description: 'DevOps流水线可视化看板',
    htmlUrl: 'https://github.com/trae/pipeline-dashboard',
    defaultBranch: 'main',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-06-18T08:00:00Z'
  },
  {
    id: 2,
    owner: 'trae',
    name: 'core-service',
    fullName: 'trae/core-service',
    description: '核心业务微服务',
    htmlUrl: 'https://github.com/trae/core-service',
    defaultBranch: 'main',
    createdAt: '2025-11-20T14:30:00Z',
    updatedAt: '2026-06-17T16:45:00Z'
  },
  {
    id: 3,
    owner: 'trae',
    name: 'frontend-app',
    fullName: 'trae/frontend-app',
    description: '前端React应用',
    htmlUrl: 'https://github.com/trae/frontend-app',
    defaultBranch: 'develop',
    createdAt: '2025-09-10T09:15:00Z',
    updatedAt: '2026-06-18T07:30:00Z'
  }
];

const prTitles = [
  'feat: 添加用户认证模块',
  'fix: 修复登录页面重定向问题',
  'refactor: 重构API请求层',
  'feat: 实现实时通知功能',
  'chore: 更新依赖包版本',
  'fix: 处理边界条件下的空值错误',
  'feat: 新增数据导出功能',
  'perf: 优化列表渲染性能',
  'docs: 更新API文档',
  'test: 增加单元测试覆盖率'
];

const generateCheckRuns = (prId: number): CheckRun[] => {
  const states = ['completed', 'completed', 'completed', 'in_progress', 'queued'];
  const conclusions = ['success', 'success', 'success', 'failure', null];
  const names = ['lint', 'unit-test', 'build', 'integration-test', 'security-scan'];

  return names.map((name, i) => {
    const status = states[i] as CheckRun['status'];
    const conclusion = status === 'completed' ? conclusions[i] as CheckRun['conclusion'] : null;
    const now = new Date();
    const startedAt = new Date(now.getTime() - (5 - i) * 60000);
    const completedAt = status === 'completed' ? new Date(startedAt.getTime() + Math.random() * 180000 + 60000) : null;

    return {
      id: prId * 100 + i,
      name,
      status,
      conclusion,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt?.toISOString() || null,
      durationSeconds: completedAt ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000) : null
    };
  });
};

const generateReviews = (prId: number): Review[] => {
  const reviewStates: Review['state'][] = ['approved', 'changes_requested', 'commented'];
  const reviews: Review[] = [];
  const numReviews = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < numReviews; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    reviews.push({
      id: prId * 10 + i,
      user,
      state: reviewStates[Math.floor(Math.random() * reviewStates.length)],
      body: ['代码逻辑清晰，建议合并', '需要处理边界情况', '测试覆盖率需要提升'][i % 3],
      submittedAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
    });
  }

  return reviews;
};

const generatePullRequests = (): PullRequest[] => {
  const prs: PullRequest[] = [];
  const states: PullRequest['state'][] = ['open', 'open', 'open', 'merged', 'closed'];

  repositories.forEach((repo, repoIdx) => {
    for (let i = 0; i < 5; i++) {
      const prId = repoIdx * 100 + i + 1;
      const user = users[Math.floor(Math.random() * users.length)];
      const state = states[i % states.length];
      const checkRuns = generateCheckRuns(prId);

      const passedChecks = checkRuns.filter(c => c.conclusion === 'success').length;
      const failedChecks = checkRuns.filter(c => c.conclusion === 'failure').length;
      const runningChecks = checkRuns.filter(c => c.status === 'in_progress' || c.status === 'queued').length;

      let ciState: 'pending' | 'success' | 'failure' | 'running' = 'pending';
      if (runningChecks > 0) ciState = 'running';
      else if (failedChecks > 0) ciState = 'failure';
      else if (passedChecks === checkRuns.length) ciState = 'success';

      const createdAt = new Date(Date.now() - (i + 1) * 3600000 * Math.random() * 24);

      prs.push({
        id: prId,
        number: i + 10 + repoIdx * 10,
        title: prTitles[(repoIdx * 5 + i) % prTitles.length],
        body: '这是一个PR的详细描述，包含了变更的内容和目的。',
        state,
        htmlUrl: `https://github.com/${repo.fullName}/pull/${i + 10}`,
        user,
        base: { ref: repo.defaultBranch, sha: `base-sha-${prId}` },
        head: { ref: `feature/${prTitles[(repoIdx * 5 + i) % prTitles.length].split(':')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-')}`, sha: `head-sha-${prId}` },
        createdAt: createdAt.toISOString(),
        updatedAt: new Date(createdAt.getTime() + 3600000).toISOString(),
        mergedAt: state === 'merged' ? new Date(createdAt.getTime() + 7200000).toISOString() : null,
        mergeable: state === 'open' ? Math.random() > 0.3 : null,
        ciStatus: {
          state: ciState,
          totalChecks: checkRuns.length,
          passedChecks,
          failedChecks,
          checks: checkRuns
        },
        reviews: generateReviews(prId),
        repoFullName: repo.fullName
      });
    }
  });

  return prs;
};

const generatePipelineSteps = (stagePrefix: string, count: number) => {
  const statuses: ('pending' | 'running' | 'success' | 'failed' | 'skipped')[] = ['success', 'success', 'running', 'pending', 'pending'];
  const stepNames = {
    build: ['Checkout代码', '安装依赖', '类型检查', '编译构建', '打包产物'],
    test: ['单元测试', '集成测试', 'E2E测试', '性能测试', '安全扫描'],
    deploy: ['构建镜像', '推送镜像仓库', '部署到Staging', '冒烟测试', '部署到Production']
  };

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[i] || 'pending';
    const name = stepNames[stagePrefix as keyof typeof stepNames][i];
    const now = new Date();
    const startedAt = status !== 'pending' ? new Date(now.getTime() - (count - i) * 120000) : null;
    const completedAt = status === 'success' || status === 'failed'
      ? new Date((startedAt?.getTime() || now.getTime()) + Math.random() * 120000 + 30000)
      : null;

    return {
      id: `${stagePrefix}-step-${i}`,
      name,
      status,
      startedAt: startedAt?.toISOString() || null,
      completedAt: completedAt?.toISOString() || null,
      durationSeconds: completedAt && startedAt
        ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
        : null,
      logSummary: status !== 'pending' ? `执行${name}步骤，${status === 'success' ? '成功完成' : status === 'failed' ? '出现错误' : '正在进行中'}...` : null
    };
  });
};

const generatePipelineRuns = (): PipelineRun[] => {
  const runs: PipelineRun[] = [];

  repositories.forEach((repo, repoIdx) => {
    for (let i = 0; i < 3; i++) {
      const runId = repoIdx * 10 + i + 1;
      const now = new Date();
      const createdAt = new Date(now.getTime() - i * 3600000 * 2);

      const stages = ['build', 'test', 'deploy'].map((stageName, stageIdx) => {
        const stageStatuses: ('pending' | 'running' | 'success' | 'failed' | 'skipped')[] = ['success', 'running', 'pending'];
        const status = i === 0 ? stageStatuses[stageIdx] : 'success';
        const steps = generatePipelineSteps(stageName, 5);

        const startedAt = status !== 'pending' ? new Date(createdAt.getTime() + stageIdx * 300000) : null;
        const completedAt = status === 'success' || status === 'failed'
          ? new Date((startedAt?.getTime() || createdAt.getTime()) + Math.random() * 300000 + 120000)
          : null;

        return {
          id: `${runId}-${stageName}`,
          name: stageName as 'build' | 'test' | 'deploy',
          status,
          startedAt: startedAt?.toISOString() || null,
          completedAt: completedAt?.toISOString() || null,
          durationSeconds: completedAt && startedAt
            ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
            : null,
          steps
        };
      });

      runs.push({
        id: runId,
        repoId: repo.id,
        repoFullName: repo.fullName,
        commitSha: `abc123${runId}`,
        branch: i === 0 ? 'feature/new-ui' : i === 1 ? 'main' : 'develop',
        trigger: ['push', 'pull_request', 'manual'][i % 3],
        createdAt: createdAt.toISOString(),
        stages
      });
    }
  });

  return runs;
};

const generateCoverageData = (): CoverageData[] => {
  const data: CoverageData[] = [];
  const branches = ['main', 'develop', 'feature/auth'];

  repositories.forEach((repo, repoIdx) => {
    branches.forEach((branch, branchIdx) => {
      let baseCoverage = 75 + repoIdx * 5 + branchIdx * 3;
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        baseCoverage += (Math.random() - 0.45) * 2;
        baseCoverage = Math.max(60, Math.min(95, baseCoverage));
        const linesTotal = 10000 + repoIdx * 5000;
        const linesCovered = Math.floor(linesTotal * baseCoverage / 100);

        data.push({
          id: repoIdx * 1000 + branchIdx * 100 + i,
          repoId: repo.id,
          repoFullName: repo.fullName,
          branch,
          commitSha: `coverage-${repoIdx}-${branchIdx}-${i}`,
          coveragePercent: Math.round(baseCoverage * 100) / 100,
          linesCovered,
          linesTotal,
          createdAt: date.toISOString()
        });
      }
    });
  });

  return data;
};

const generateWorkflows = (): Workflow[] => {
  const workflowConfigs = [
    { id: 1, name: 'CI Pipeline', path: '.github/workflows/ci.yml' },
    { id: 2, name: 'Deploy to Production', path: '.github/workflows/deploy.yml' },
    { id: 3, name: 'Nightly Build', path: '.github/workflows/nightly.yml' },
    { id: 4, name: 'Release', path: '.github/workflows/release.yml' }
  ];

  return repositories.flatMap((repo, repoIdx) =>
    workflowConfigs.map((wf, wfIdx) => {
      const now = new Date();
      const lastRun: WorkflowRun & { repoFullName: string } = {
        id: repoIdx * 100 + wfIdx + 1,
        name: wf.name,
        status: wfIdx === 0 ? 'in_progress' : 'completed',
        conclusion: wfIdx === 0 ? null : (wfIdx === 2 ? 'failure' : 'success'),
        htmlUrl: `https://github.com/${repo.fullName}/actions/runs/${repoIdx * 100 + wfIdx + 1}`,
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
        updatedAt: wfIdx === 0 ? now.toISOString() : new Date(now.getTime() - 1800000).toISOString(),
        repoFullName: repo.fullName
      };

      return {
        id: wf.id + repoIdx * 10,
        name: wf.name,
        path: wf.path,
        state: 'active',
        htmlUrl: `https://github.com/${repo.fullName}/blob/main/${wf.path}`,
        badgeUrl: `https://github.com/${repo.fullName}/workflows/${encodeURIComponent(wf.name)}/badge.svg`,
        lastRun
      };
    })
  );
};

const generateDeploymentStats = (): DeploymentStats[] => {
  const periods = ['2026-06-16', '2026-06-17', '2026-06-18', '2026-W24', '2026-06'];

  return repositories.flatMap(repo =>
    periods.map((period, i) => {
      const deploymentCount = i < 3 ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 30) + 10;
      const failureCount = Math.floor(deploymentCount * (Math.random() * 0.2 + 0.05));
      const successCount = deploymentCount - failureCount;

      return {
        repoId: repo.id,
        repoName: repo.fullName,
        period,
        deploymentCount,
        successCount,
        failureCount,
        successRate: Math.round((successCount / deploymentCount) * 10000) / 100,
        averageDurationSeconds: Math.floor(Math.random() * 300) + 120
      };
    })
  );
};

export const mockRepositories = repositories;
export const mockPullRequests = generatePullRequests();
export const mockPipelineRuns = generatePipelineRuns();
export const mockCoverageData = generateCoverageData();
export const mockWorkflows = generateWorkflows();
export const mockDeploymentStats = generateDeploymentStats();
