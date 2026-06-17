import axios from 'axios';
import type {
  Repository,
  PullRequest,
  PipelineRun,
  CoverageData,
  Workflow,
  WorkflowRun,
  DeploymentStats,
  ApiResponse
} from '../../shared/types.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const handleResponse = <T>(response: { data: ApiResponse<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }
  return response.data.data as T;
};

export const apiService = {
  getHealth: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await api.get('/health');
    return response.data;
  },

  getRepositories: async (): Promise<Repository[]> => {
    const response = await api.get('/repos');
    return handleResponse<Repository[]>(response);
  },

  getPullRequests: async (owner: string, repo: string): Promise<PullRequest[]> => {
    const response = await api.get(`/repos/${owner}/${repo}/prs`);
    return handleResponse<PullRequest[]>(response);
  },

  getPullRequest: async (owner: string, repo: string, number: number): Promise<PullRequest> => {
    const response = await api.get(`/repos/${owner}/${repo}/prs/${number}`);
    return handleResponse<PullRequest>(response);
  },

  getPipelineRuns: async (owner: string, repo: string): Promise<PipelineRun[]> => {
    const response = await api.get(`/repos/${owner}/${repo}/pipelines`);
    return handleResponse<PipelineRun[]>(response);
  },

  getLatestPipeline: async (owner: string, repo: string): Promise<PipelineRun> => {
    const response = await api.get(`/repos/${owner}/${repo}/pipelines/latest`);
    return handleResponse<PipelineRun>(response);
  },

  getCoverageData: async (owner: string, repo: string, branch?: string): Promise<CoverageData[]> => {
    const params = branch ? { branch } : {};
    const response = await api.get(`/repos/${owner}/${repo}/coverage`, { params });
    return handleResponse<CoverageData[]>(response);
  },

  getWorkflows: async (owner: string, repo: string): Promise<Workflow[]> => {
    const response = await api.get(`/repos/${owner}/${repo}/workflows`);
    return handleResponse<Workflow[]>(response);
  },

  getWorkflowRuns: async (owner: string, repo: string): Promise<WorkflowRun[]> => {
    const response = await api.get(`/repos/${owner}/${repo}/workflows/runs`);
    return handleResponse<WorkflowRun[]>(response);
  },

  triggerWorkflow: async (
    owner: string,
    repo: string,
    workflowId: number,
    ref: string = 'main',
    inputs?: Record<string, string>
  ): Promise<WorkflowRun & { repoFullName: string }> => {
    const response = await api.post(`/repos/${owner}/${repo}/workflows/${workflowId}/dispatch`, {
      ref,
      inputs,
    });
    return handleResponse<WorkflowRun & { repoFullName: string }>(response);
  },

  getWorkflowRun: async (owner: string, repo: string, runId: number): Promise<WorkflowRun> => {
    const response = await api.get(`/repos/${owner}/${repo}/workflows/runs/${runId}`);
    return handleResponse<WorkflowRun>(response);
  },

  getDeploymentStats: async (repo?: string, period?: string): Promise<DeploymentStats[]> => {
    const params: Record<string, string> = {};
    if (repo) params.repo = repo;
    if (period) params.period = period;
    const response = await api.get('/statistics/deployments', { params });
    return handleResponse<DeploymentStats[]>(response);
  },

  getSuccessRate: async (repo?: string, period?: string): Promise<DeploymentStats[]> => {
    const params: Record<string, string> = {};
    if (repo) params.repo = repo;
    if (period) params.period = period;
    const response = await api.get('/statistics/success-rate', { params });
    return handleResponse<DeploymentStats[]>(response);
  },

  triggerTestPush: async (owner: string, repo: string): Promise<any> => {
    const response = await api.post(`/webhook/test/push/${owner}/${repo}`);
    return response.data;
  },

  getConfig: async (): Promise<Record<string, string>> => {
    const response = await api.get('/config');
    return handleResponse<Record<string, string>>(response);
  },

  updateConfig: async (key: string, value: string): Promise<{ key: string; value: string }> => {
    const response = await api.put('/config', { key, value });
    return handleResponse<{ key: string; value: string }>(response);
  },
};

export default apiService;
