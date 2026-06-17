import { create } from 'zustand';
import type {
  Repository,
  PullRequest,
  PipelineRun,
  CoverageData,
  Workflow,
  WorkflowRun,
  DeploymentStats,
} from '../../shared/types.js';

interface DashboardState {
  repositories: Repository[];
  pullRequests: Map<string, PullRequest[]>;
  pipelineRuns: Map<string, PipelineRun[]>;
  coverageData: Map<string, CoverageData[]>;
  workflows: Map<string, Workflow[]>;
  workflowRuns: Map<string, WorkflowRun[]>;
  deploymentStats: DeploymentStats[];
  successRateStats: DeploymentStats[];
  selectedRepo: string | null;
  wsConnected: boolean;
  loading: Set<string>;
  errors: Map<string, string>;

  setRepositories: (repos: Repository[]) => void;
  setPullRequests: (repoFullName: string, prs: PullRequest[]) => void;
  updatePullRequest: (pr: PullRequest) => void;
  setPipelineRuns: (repoFullName: string, runs: PipelineRun[]) => void;
  updatePipelineRun: (run: PipelineRun) => void;
  setCoverageData: (repoFullName: string, data: CoverageData[]) => void;
  setWorkflows: (repoFullName: string, workflows: Workflow[]) => void;
  setWorkflowRuns: (repoFullName: string, runs: WorkflowRun[]) => void;
  updateWorkflowRun: (run: WorkflowRun & { repoFullName: string }) => void;
  setDeploymentStats: (stats: DeploymentStats[]) => void;
  setSuccessRateStats: (stats: DeploymentStats[]) => void;
  setSelectedRepo: (repo: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;
  isLoading: (key: string) => boolean;
  getError: (key: string) => string | undefined;
  clearAll: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  repositories: [],
  pullRequests: new Map(),
  pipelineRuns: new Map(),
  coverageData: new Map(),
  workflows: new Map(),
  workflowRuns: new Map(),
  deploymentStats: [],
  successRateStats: [],
  selectedRepo: null,
  wsConnected: false,
  loading: new Set(),
  errors: new Map(),

  setRepositories: (repos) => set({ repositories: repos }),

  setPullRequests: (repoFullName, prs) =>
    set((state) => {
      const newMap = new Map(state.pullRequests);
      newMap.set(repoFullName, prs);
      return { pullRequests: newMap };
    }),

  updatePullRequest: (pr) =>
    set((state) => {
      const newMap = new Map(state.pullRequests);
      const existing = newMap.get(pr.repoFullName) || [];
      const idx = existing.findIndex((p) => p.id === pr.id);
      if (idx >= 0) {
        const updated = [...existing];
        updated[idx] = pr;
        newMap.set(pr.repoFullName, updated);
      } else {
        newMap.set(pr.repoFullName, [pr, ...existing]);
      }
      return { pullRequests: newMap };
    }),

  setPipelineRuns: (repoFullName, runs) =>
    set((state) => {
      const newMap = new Map(state.pipelineRuns);
      newMap.set(repoFullName, runs);
      return { pipelineRuns: newMap };
    }),

  updatePipelineRun: (run) =>
    set((state) => {
      const newMap = new Map(state.pipelineRuns);
      const existing = newMap.get(run.repoFullName) || [];
      const idx = existing.findIndex((r) => r.id === run.id);
      if (idx >= 0) {
        const updated = [...existing];
        updated[idx] = run;
        newMap.set(run.repoFullName, updated);
      } else {
        newMap.set(run.repoFullName, [run, ...existing]);
      }
      return { pipelineRuns: newMap };
    }),

  setCoverageData: (repoFullName, data) =>
    set((state) => {
      const newMap = new Map(state.coverageData);
      newMap.set(repoFullName, data);
      return { coverageData: newMap };
    }),

  setWorkflows: (repoFullName, workflows) =>
    set((state) => {
      const newMap = new Map(state.workflows);
      newMap.set(repoFullName, workflows);
      return { workflows: newMap };
    }),

  setWorkflowRuns: (repoFullName, runs) =>
    set((state) => {
      const newMap = new Map(state.workflowRuns);
      newMap.set(repoFullName, runs);
      return { workflowRuns: newMap };
    }),

  updateWorkflowRun: (run) =>
    set((state) => {
      const newMap = new Map(state.workflowRuns);
      const existing = newMap.get(run.repoFullName) || [];
      const idx = existing.findIndex((r) => r.id === run.id);
      if (idx >= 0) {
        const updated = [...existing];
        updated[idx] = run;
        newMap.set(run.repoFullName, updated);
      } else {
        newMap.set(run.repoFullName, [run, ...existing]);
      }
      return { workflowRuns: newMap };
    }),

  setDeploymentStats: (stats) => set({ deploymentStats: stats }),

  setSuccessRateStats: (stats) => set({ successRateStats: stats }),

  setSelectedRepo: (repo) => set({ selectedRepo: repo }),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  setLoading: (key, loading) =>
    set((state) => {
      const newLoading = new Set(state.loading);
      if (loading) {
        newLoading.add(key);
      } else {
        newLoading.delete(key);
      }
      return { loading: newLoading };
    }),

  setError: (key, error) =>
    set((state) => {
      const newErrors = new Map(state.errors);
      if (error) {
        newErrors.set(key, error);
      } else {
        newErrors.delete(key);
      }
      return { errors: newErrors };
    }),

  isLoading: (key) => get().loading.has(key),

  getError: (key) => get().errors.get(key),

  clearAll: () =>
    set({
      repositories: [],
      pullRequests: new Map(),
      pipelineRuns: new Map(),
      coverageData: new Map(),
      workflows: new Map(),
      workflowRuns: new Map(),
      deploymentStats: [],
      successRateStats: [],
      selectedRepo: null,
      loading: new Set(),
      errors: new Map(),
    }),
}));

export default useDashboardStore;
