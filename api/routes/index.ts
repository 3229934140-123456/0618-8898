import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { verifySignature, processWebhook } from '../services/webhook.js';
import { broadcastWorkflowUpdate } from '../services/websocket.js';
import {
  triggerWorkflowDispatch,
  fetchWorkflows,
  fetchLatestWorkflowRuns,
  startWorkflowRunPolling,
  reinitializeOctokit,
} from '../services/github.js';
import type { ApiResponse, WorkflowRun, DateRange } from '../../shared/types.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/repos', (_req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const repos = db.getRepositories();
    res.json({ success: true, data: repos });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/repos/:owner/:name/prs', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name } = req.params;
    const repoFullName = `${owner}/${name}`;
    const prs = db.getPullRequests(repoFullName);
    res.json({ success: true, data: prs });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/repos/:owner/:name/prs/:number', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name, number } = req.params;
    const repoFullName = `${owner}/${name}`;
    const pr = db.getPullRequestByNumber(repoFullName, parseInt(number));
    if (!pr) {
      return res.status(404).json({ success: false, error: 'PR not found' });
    }
    res.json({ success: true, data: pr });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/repos/:owner/:name/pipelines', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name } = req.params;
    const repoFullName = `${owner}/${name}`;
    const pipelines = db.getPipelineRuns(repoFullName);
    res.json({ success: true, data: pipelines });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/repos/:owner/:name/pipelines/latest', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name } = req.params;
    const repoFullName = `${owner}/${name}`;
    const pipeline = db.getLatestPipelineRun(repoFullName);
    if (!pipeline) {
      return res.status(404).json({ success: false, error: 'No pipeline runs found' });
    }
    res.json({ success: true, data: pipeline });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/repos/:owner/:name/coverage', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name } = req.params;
    const { branch } = req.query;
    const repoFullName = `${owner}/${name}`;
    const coverage = db.getCoverageData(repoFullName, branch as string);
    res.json({ success: true, data: coverage });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/repos/:owner/:name/workflows', async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name } = req.params;
    const repoFullName = `${owner}/${name}`;
    
    const githubWorkflows = await fetchWorkflows(owner, name);
    
    if (githubWorkflows.length > 0) {
      res.json({ success: true, data: githubWorkflows });
      return;
    }
    
    const workflows = db.getWorkflows(repoFullName);
    res.json({ success: true, data: workflows });
  } catch (error) {
    console.error('[API] Failed to get workflows:', error);
    const { owner, name } = req.params;
    const repoFullName = `${owner}/${name}`;
    const workflows = db.getWorkflows(repoFullName);
    res.json({ success: true, data: workflows, warning: '使用模拟数据' });
  }
});

router.get('/repos/:owner/:name/workflows/runs', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name } = req.params;
    const repoFullName = `${owner}/${name}`;
    const runs = db.getWorkflowRuns(repoFullName);
    res.json({ success: true, data: runs });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/repos/:owner/:name/workflows/:id/dispatch', async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { owner, name, id } = req.params;
    const { ref, inputs } = req.body;
    const repoFullName = `${owner}/${name}`;
    const workflowId = parseInt(id);

    const repo = db.getRepositoryByFullName(repoFullName);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const now = new Date();
    const tempRun: WorkflowRun & { repoFullName: string } = {
      id: db.getNextId(),
      name: `Workflow ${workflowId}`,
      status: 'queued',
      conclusion: null,
      htmlUrl: `https://github.com/${repoFullName}/actions`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      repoFullName
    };

    try {
      const triggered = await triggerWorkflowDispatch(owner, name, workflowId, ref, inputs);
      
      if (triggered) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const latestRuns = await fetchLatestWorkflowRuns(owner, name);
        
        if (latestRuns.length > 0) {
          const newRun = latestRuns[0];
          db.upsertWorkflowRun(newRun);
          broadcastWorkflowUpdate(newRun);
          
          startWorkflowRunPolling(owner, name, newRun.id);
          
          res.json({ success: true, data: newRun });
          return;
        }
      }
      
      db.upsertWorkflowRun(tempRun);
      broadcastWorkflowUpdate(tempRun);
      simulateWorkflowExecution(tempRun);
      res.json({ success: true, data: tempRun });
    } catch (githubError: any) {
      console.log('[GitHub] API call failed, falling back to simulation:', githubError.message);
      db.upsertWorkflowRun(tempRun);
      broadcastWorkflowUpdate(tempRun);
      simulateWorkflowExecution(tempRun);
      res.json({ success: true, data: tempRun, warning: 'GitHub API未配置，使用模拟模式' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/repos/:owner/:name/workflows/runs/:runId', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { runId } = req.params;
    const runs = db.getWorkflowRuns();
    const run = runs.find(r => r.id === parseInt(runId));
    if (!run) {
      return res.status(404).json({ success: false, error: 'Workflow run not found' });
    }
    res.json({ success: true, data: run });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/statistics/deployments', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { repo, period } = req.query;
    const stats = db.getDeploymentStats(repo as string, period as string);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/statistics/success-rate', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { repo, period } = req.query;
    const stats = db.getDeploymentStats(repo as string, period as string);

    const result = stats.map(s => ({
      repoId: s.repoId,
      repoName: s.repoName,
      period: s.period,
      successRate: s.successRate,
      deploymentCount: s.deploymentCount,
      successCount: s.successCount,
      failureCount: s.failureCount
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/webhook/github', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-hub-signature-256'] as string) || '';
    const event = (req.headers['x-github-event'] as string) || '';
    const deliveryId = (req.headers['x-github-delivery'] as string) || '';

    let secret = '';
    try {
      secret = db.getConfig('webhook_secret') || '';
    } catch (configError) {
      console.error('[Webhook] Failed to read webhook_secret config:', configError);
      secret = '';
    }

    if (secret && signature) {
      let rawBody = '';
      try {
        rawBody = (req as any).rawBody;
        if (typeof rawBody !== 'string') {
          rawBody = JSON.stringify(req.body || {});
        }
      } catch (bodyError) {
        console.error('[Webhook] Failed to read raw body:', bodyError);
        rawBody = JSON.stringify(req.body || {});
      }

      let valid = false;
      try {
        valid = verifySignature(rawBody, signature, secret);
      } catch (verifyError) {
        console.error('[Webhook] Signature verification threw exception:', verifyError);
        valid = false;
      }

      if (!valid) {
        console.warn(`[Webhook] Signature verification failed for ${event} (${deliveryId})`);
        return res.status(403).json({ error: 'Invalid signature' });
      }
    }

    console.log(`[Webhook] Received ${event} event (${deliveryId})`);

    const result = await processWebhook(event, req.body);

    res.json({ success: true, event, deliveryId, result });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    if ((error as any).message?.includes('signature') || (error as any).message?.includes('Invalid')) {
      return res.status(403).json({ error: 'Invalid signature' });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/webhook/test/push/:owner/:name', async (req: Request, res: Response) => {
  try {
    const { owner, name } = req.params;
    const repoFullName = `${owner}/${name}`;

    const mockPayload = {
      repository: {
        full_name: repoFullName,
        name: name,
        owner: { login: owner }
      },
      ref: 'refs/heads/feature/test',
      after: `test-commit-${Date.now()}`,
      head_commit: {
        message: 'Test push event',
        id: `test-commit-${Date.now()}`
      },
      pusher: {
        name: 'test-user',
        email: 'test@example.com'
      }
    };

    const result = await processWebhook('push', mockPayload);
    res.json({ success: true, message: 'Test push event triggered', result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/config', (_req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const config = db.getAllConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/config', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { key, value } = req.body;
    db.setConfig(key, value);
    
    if (key === 'github_token') {
      reinitializeOctokit();
      console.log('[Config] GitHub token updated, Octokit reinitialized');
    }
    
    if (key === 'webhook_secret') {
      console.log('[Config] Webhook secret updated, will take effect immediately for next webhook request');
    }
    
    const freshValue = db.getConfig(key);
    res.json({ success: true, data: { key, value: freshValue ?? value } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

const simulateWorkflowExecution = async (run: WorkflowRun & { repoFullName: string }) => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  await delay(2000);
  run.status = 'in_progress';
  run.updatedAt = new Date().toISOString();
  db.upsertWorkflowRun(run);
  broadcastWorkflowUpdate(run);

  await delay(Math.random() * 8000 + 5000);
  run.status = 'completed';
  run.conclusion = Math.random() > 0.1 ? 'success' : 'failure';
  run.updatedAt = new Date().toISOString();
  db.upsertWorkflowRun(run);
  broadcastWorkflowUpdate(run);
};

export default router;
