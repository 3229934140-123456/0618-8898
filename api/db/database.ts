import {
  mockRepositories,
  mockPullRequests,
  mockPipelineRuns,
  mockCoverageData,
  mockWorkflows,
  mockDeploymentStats
} from '../services/mockData.js';
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

interface ConfigEntry {
  key: string;
  value: string;
  updatedAt: string;
}

class InMemoryDatabase {
  private repositories: Repository[] = [...mockRepositories];
  private pullRequests: PullRequest[] = [...mockPullRequests];
  private pipelineRuns: PipelineRun[] = [...mockPipelineRuns];
  private coverageRecords: CoverageData[] = [...mockCoverageData];
  private workflowRuns: WorkflowRun[] = [];
  private config: Map<string, ConfigEntry> = new Map();
  private nextId: number = 1000;

  constructor() {
    this.initConfig();
    this.extractWorkflowRuns();
  }

  private initConfig() {
    const now = new Date().toISOString();
    const repos = JSON.stringify([
      { owner: 'trae', name: 'pipeline-dashboard', fullName: 'trae/pipeline-dashboard' },
      { owner: 'trae', name: 'core-service', fullName: 'trae/core-service' },
      { owner: 'trae', name: 'frontend-app', fullName: 'trae/frontend-app' }
    ]);

    this.config.set('github_token', { key: 'github_token', value: '', updatedAt: now });
    this.config.set('webhook_secret', { key: 'webhook_secret', value: 'webhook-secret-123', updatedAt: now });
    this.config.set('repos', { key: 'repos', value: repos, updatedAt: now });
  }

  private extractWorkflowRuns() {
    mockWorkflows.forEach(wf => {
      if (wf.lastRun) {
        this.workflowRuns.push(wf.lastRun);
      }
    });
  }

  getNextId(): number {
    return this.nextId++;
  }

  getRepositories(): Repository[] {
    return this.repositories;
  }

  getRepositoryById(id: number): Repository | undefined {
    return this.repositories.find(r => r.id === id);
  }

  getRepositoryByFullName(fullName: string): Repository | undefined {
    return this.repositories.find(r => r.fullName === fullName);
  }

  upsertRepository(repo: Omit<Repository, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): Repository {
    const now = new Date().toISOString();
    if (repo.id) {
      const idx = this.repositories.findIndex(r => r.id === repo.id);
      if (idx >= 0) {
        this.repositories[idx] = { ...this.repositories[idx], ...repo, updatedAt: now };
        return this.repositories[idx];
      }
    }
    const existing = this.repositories.find(r => r.fullName === repo.fullName);
    if (existing) {
      return { ...existing, ...repo, updatedAt: now };
    }
    const newRepo: Repository = {
      ...repo,
      id: this.getNextId(),
      createdAt: now,
      updatedAt: now
    };
    this.repositories.push(newRepo);
    return newRepo;
  }

  getPullRequests(repoFullName?: string): PullRequest[] {
    let prs = this.pullRequests;
    if (repoFullName) {
      prs = prs.filter(pr => pr.repoFullName === repoFullName);
    }
    return prs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getPullRequestById(id: number): PullRequest | undefined {
    return this.pullRequests.find(pr => pr.id === id);
  }

  getPullRequestByNumber(repoFullName: string, number: number): PullRequest | undefined {
    return this.pullRequests.find(pr => pr.repoFullName === repoFullName && pr.number === number);
  }

  upsertPullRequest(pr: Omit<PullRequest, 'id'> & { id?: number }): PullRequest {
    const now = new Date().toISOString();
    if (pr.id) {
      const idx = this.pullRequests.findIndex(p => p.id === pr.id);
      if (idx >= 0) {
        this.pullRequests[idx] = { ...this.pullRequests[idx], ...pr, updatedAt: now };
        return this.pullRequests[idx];
      }
    }
    const existing = this.pullRequests.find(p => p.repoFullName === pr.repoFullName && p.number === pr.number);
    if (existing) {
      return { ...existing, ...pr, updatedAt: now };
    }
    const newPr: PullRequest = {
      ...pr,
      id: pr.id || this.getNextId(),
      updatedAt: now
    };
    this.pullRequests.push(newPr);
    return newPr;
  }

  getPipelineRuns(repoFullName?: string): PipelineRun[] {
    let runs = this.pipelineRuns;
    if (repoFullName) {
      runs = runs.filter(r => r.repoFullName === repoFullName);
    }
    return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getLatestPipelineRun(repoFullName: string): PipelineRun | undefined {
    return this.getPipelineRuns(repoFullName)[0];
  }

  upsertPipelineRun(run: Omit<PipelineRun, 'id' | 'createdAt'> & { id?: number; createdAt?: string }): PipelineRun {
    const now = new Date().toISOString();
    if (run.id) {
      const idx = this.pipelineRuns.findIndex(r => r.id === run.id);
      if (idx >= 0) {
        this.pipelineRuns[idx] = { ...this.pipelineRuns[idx], ...run };
        return this.pipelineRuns[idx];
      }
    }
    const newRun: PipelineRun = {
      ...run,
      id: run.id || this.getNextId(),
      createdAt: run.createdAt || now
    };
    this.pipelineRuns.unshift(newRun);
    return newRun;
  }

  getCoverageData(repoFullName?: string, branch?: string): CoverageData[] {
    let data = this.coverageRecords;
    if (repoFullName) {
      data = data.filter(d => d.repoFullName === repoFullName);
    }
    if (branch) {
      data = data.filter(d => d.branch === branch);
    }
    return data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  addCoverageRecord(record: Omit<CoverageData, 'id' | 'createdAt'>): CoverageData {
    const now = new Date().toISOString();
    const newRecord: CoverageData = {
      ...record,
      id: this.getNextId(),
      createdAt: now
    };
    this.coverageRecords.push(newRecord);
    return newRecord;
  }

  getWorkflows(repoFullName?: string): Workflow[] {
    let workflows = mockWorkflows;
    if (repoFullName) {
      workflows = workflows.filter(wf => {
        const repo = this.repositories.find(r => r.id === Math.floor(wf.id / 10));
        return repo?.fullName === repoFullName;
      });
    }
    return workflows;
  }

  getWorkflowRuns(repoFullName?: string): WorkflowRun[] {
    let runs = this.workflowRuns;
    if (repoFullName) {
      const repo = this.repositories.find(r => r.fullName === repoFullName);
      if (repo) {
        runs = runs.filter(r => r.id >= repo.id * 100 && r.id < (repo.id + 1) * 100);
      }
    }
    return runs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  upsertWorkflowRun(run: WorkflowRun & { repoFullName?: string }): WorkflowRun {
    const idx = this.workflowRuns.findIndex(r => r.id === run.id);
    if (idx >= 0) {
      this.workflowRuns[idx] = { ...this.workflowRuns[idx], ...run };
      return this.workflowRuns[idx];
    }
    const newRun: WorkflowRun = { ...run };
    this.workflowRuns.unshift(newRun);
    return newRun;
  }

  getDeploymentStats(repoFullName?: string, period?: string): DeploymentStats[] {
    const now = new Date('2026-06-18');
    const result: DeploymentStats[] = [];
    
    const targetRepos = repoFullName 
      ? this.repositories.filter(r => r.fullName === repoFullName)
      : this.repositories;

    const generateDailyStats = (days: number, labelPrefix: string) => {
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        targetRepos.forEach(repo => {
          const deploymentCount = Math.floor(Math.random() * 8) + 2;
          const failureCount = Math.floor(deploymentCount * (Math.random() * 0.2 + 0.05));
          const successCount = deploymentCount - failureCount;
          
          result.push({
            repoId: repo.id,
            repoName: repo.fullName,
            period: dateStr,
            deploymentCount,
            successCount,
            failureCount,
            successRate: Math.round((successCount / deploymentCount) * 10000) / 100,
            averageDurationSeconds: Math.floor(Math.random() * 300) + 120
          });
        });
      }
    };

    const generateWeeklyStats = (weeks: number) => {
      for (let i = weeks - 1; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekNum = Math.ceil((weekStart.getDate() + new Date(weekStart.getFullYear(), weekStart.getMonth(), 1).getDay()) / 7);
        const periodStr = `${weekStart.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        
        targetRepos.forEach(repo => {
          const deploymentCount = Math.floor(Math.random() * 30) + 15;
          const failureCount = Math.floor(deploymentCount * (Math.random() * 0.2 + 0.05));
          const successCount = deploymentCount - failureCount;
          
          result.push({
            repoId: repo.id,
            repoName: repo.fullName,
            period: periodStr,
            deploymentCount,
            successCount,
            failureCount,
            successRate: Math.round((successCount / deploymentCount) * 10000) / 100,
            averageDurationSeconds: Math.floor(Math.random() * 300) + 120
          });
        });
      }
    };

    const generateMonthlyStats = (months: number) => {
      for (let i = months - 1; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const periodStr = `${monthDate.getFullYear()}-${(monthDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        targetRepos.forEach(repo => {
          const deploymentCount = Math.floor(Math.random() * 80) + 40;
          const failureCount = Math.floor(deploymentCount * (Math.random() * 0.2 + 0.05));
          const successCount = deploymentCount - failureCount;
          
          result.push({
            repoId: repo.id,
            repoName: repo.fullName,
            period: periodStr,
            deploymentCount,
            successCount,
            failureCount,
            successRate: Math.round((successCount / deploymentCount) * 10000) / 100,
            averageDurationSeconds: Math.floor(Math.random() * 300) + 120
          });
        });
      }
    };

    const generateQuarterlyStats = (quarters: number) => {
      for (let i = quarters - 1; i >= 0; i--) {
        const currentQuarter = Math.floor(now.getMonth() / 3) - i;
        const year = now.getFullYear() + Math.floor(currentQuarter / 4);
        const q = ((currentQuarter % 4) + 4) % 4 + 1;
        const periodStr = `${year}-Q${q}`;
        
        targetRepos.forEach(repo => {
          const deploymentCount = Math.floor(Math.random() * 200) + 100;
          const failureCount = Math.floor(deploymentCount * (Math.random() * 0.2 + 0.05));
          const successCount = deploymentCount - failureCount;
          
          result.push({
            repoId: repo.id,
            repoName: repo.fullName,
            period: periodStr,
            deploymentCount,
            successCount,
            failureCount,
            successRate: Math.round((successCount / deploymentCount) * 10000) / 100,
            averageDurationSeconds: Math.floor(Math.random() * 300) + 120
          });
        });
      }
    };

    switch (period) {
      case 'week':
        generateDailyStats(7, 'day');
        break;
      case 'month':
        generateDailyStats(30, 'day');
        generateWeeklyStats(4);
        break;
      case 'quarter':
        generateWeeklyStats(13);
        generateMonthlyStats(3);
        break;
      case 'year':
        generateMonthlyStats(12);
        generateQuarterlyStats(4);
        break;
      default:
        generateDailyStats(7, 'day');
        generateWeeklyStats(4);
        generateMonthlyStats(3);
    }

    return result;
  }

  getConfig(key: string): string | undefined {
    return this.config.get(key)?.value;
  }

  setConfig(key: string, value: string): void {
    this.config.set(key, { key, value, updatedAt: new Date().toISOString() });
  }

  getAllConfig(): Record<string, string> {
    const result: Record<string, string> = {};
    this.config.forEach((entry, key) => {
      result[key] = entry.value;
    });
    return result;
  }

  getCheckRuns(prId: number): CheckRun[] {
    const pr = this.pullRequests.find(p => p.id === prId);
    return pr?.ciStatus.checks || [];
  }

  getReviews(prId: number): Review[] {
    const pr = this.pullRequests.find(p => p.id === prId);
    return pr?.reviews || [];
  }
}

export const db = new InMemoryDatabase();
export default db;
