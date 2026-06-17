import { Octokit } from 'octokit';
import db from '../db/database.js';
import { broadcastWorkflowUpdate } from './websocket.js';
import type { WorkflowRun, Workflow } from '../../shared/types.js';

let octokit: Octokit | null = null;

const getOctokit = (): Octokit | null => {
  const token = db.getConfig('github_token');
  if (!token) {
    return null;
  }
  if (!octokit) {
    octokit = new Octokit({ auth: token });
  }
  return octokit;
};

export const reinitializeOctokit = (): void => {
  octokit = null;
  getOctokit();
};

export const triggerWorkflowDispatch = async (
  owner: string,
  repo: string,
  workflowId: number,
  ref: string,
  inputs?: Record<string, string>
): Promise<boolean> => {
  const octo = getOctokit();
  if (!octo) {
    console.log('[GitHub] No token configured, using mock mode');
    return false;
  }

  try {
    const workflow = await octo.rest.actions.getWorkflow({
      owner,
      repo,
      workflow_id: workflowId,
    });

    await octo.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
      inputs: inputs || {},
    });

    console.log(`[GitHub] Workflow ${workflow.data.name} (${workflowId}) triggered successfully`);
    return true;
  } catch (error) {
    console.error('[GitHub] Failed to trigger workflow:', error);
    throw error;
  }
};

export const fetchWorkflowRun = async (
  owner: string,
  repo: string,
  runId: number
): Promise<WorkflowRun & { repoFullName: string } | null> => {
  const octo = getOctokit();
  if (!octo) {
    return null;
  }

  try {
    const { data } = await octo.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    return {
      id: data.id,
      name: data.name,
      status: data.status as any,
      conclusion: data.conclusion as any,
      htmlUrl: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      repoFullName: `${owner}/${repo}`,
    };
  } catch (error) {
    console.error('[GitHub] Failed to fetch workflow run:', error);
    return null;
  }
};

export const fetchLatestWorkflowRuns = async (
  owner: string,
  repo: string
): Promise<(WorkflowRun & { repoFullName: string })[]> => {
  const octo = getOctokit();
  if (!octo) {
    return [];
  }

  try {
    const { data } = await octo.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 5,
    });

    return data.workflow_runs.map((run: any) => ({
      id: run.id,
      name: run.name,
      status: run.status as any,
      conclusion: run.conclusion as any,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      repoFullName: `${owner}/${repo}`,
    }));
  } catch (error) {
    console.error('[GitHub] Failed to fetch workflow runs:', error);
    return [];
  }
};

export const fetchWorkflows = async (
  owner: string,
  repo: string
): Promise<Workflow[]> => {
  const octo = getOctokit();
  if (!octo) {
    return [];
  }

  try {
    const { data } = await octo.rest.actions.listRepoWorkflows({
      owner,
      repo,
    });

    const workflows: Workflow[] = await Promise.all(
      data.workflows.map(async (wf: any) => {
        const runs = await octo.rest.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: wf.id,
          per_page: 1,
        });

        const lastRun = runs.data.workflow_runs[0];

        return {
          id: wf.id,
          name: wf.name,
          path: wf.path,
          state: wf.state as 'active' | 'disabled',
          htmlUrl: wf.html_url,
          badgeUrl: wf.badge_url || `https://github.com/${owner}/${repo}/actions/workflows/${wf.path}/badge.svg`,
          lastRun: lastRun
            ? {
                id: lastRun.id,
                name: lastRun.name,
                status: lastRun.status as any,
                conclusion: lastRun.conclusion as any,
                htmlUrl: lastRun.html_url,
                createdAt: lastRun.created_at,
                updatedAt: lastRun.updated_at,
              }
            : null,
        };
      })
    );

    return workflows;
  } catch (error) {
    console.error('[GitHub] Failed to fetch workflows:', error);
    return [];
  }
};

const activePolls = new Map<string, NodeJS.Timeout>();

export const startWorkflowRunPolling = (
  owner: string,
  repo: string,
  runId: number,
  intervalMs: number = 5000
): void => {
  const key = `${owner}/${repo}/${runId}`;
  
  if (activePolls.has(key)) {
    return;
  }

  console.log(`[GitHub] Start polling workflow run ${runId} for ${owner}/${repo}`);

  const poll = async () => {
    const run = await fetchWorkflowRun(owner, repo, runId);
    if (run) {
      db.upsertWorkflowRun(run);
      broadcastWorkflowUpdate(run);

      if (run.status === 'completed') {
        console.log(`[GitHub] Workflow run ${runId} completed with conclusion: ${run.conclusion}`);
        const timer = activePolls.get(key);
        if (timer) {
          clearInterval(timer);
          activePolls.delete(key);
        }
      }
    }
  };

  poll();
  
  const timer = setInterval(poll, intervalMs);
  activePolls.set(key, timer);
};

export const stopAllPolling = (): void => {
  activePolls.forEach((timer) => clearInterval(timer));
  activePolls.clear();
};

export const syncAllActiveWorkflowRuns = async (
  owner: string,
  repo: string
): Promise<void> => {
  const octo = getOctokit();
  if (!octo) return;

  try {
    const runs = await fetchLatestWorkflowRuns(owner, repo);
    const repoFullName = `${owner}/${repo}`;

    for (const run of runs) {
      const dbRun = db.getWorkflowRuns(repoFullName).find((r) => r.id === run.id);
      
      if (!dbRun || dbRun.status !== run.status || dbRun.conclusion !== run.conclusion) {
        db.upsertWorkflowRun(run);
        broadcastWorkflowUpdate(run);
      }

      if (run.status === 'in_progress' || run.status === 'queued') {
        startWorkflowRunPolling(owner, repo, run.id);
      }
    }
  } catch (error) {
    console.error('[GitHub] Failed to sync workflow runs:', error);
  }
};
