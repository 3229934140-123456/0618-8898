import { useEffect, useCallback, useRef, useState } from 'react';
import { wsService } from '../services/websocket.js';
import { useDashboardStore } from '../store/useDashboardStore.js';
import type { PullRequest, PipelineRun, WorkflowRun, DeploymentStats, WSEvent } from '../../shared/types.js';

export const useWebSocket = (repoFullName?: string) => {
  const {
    updatePullRequest,
    updatePipelineRun,
    updateWorkflowRun,
    setWsConnected,
  } = useDashboardStore();

  const subscribedReposRef = useRef<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Set<(event: WSEvent) => void>>(new Set());

  const connect = useCallback(() => {
    wsService.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsService.disconnect();
  }, []);

  const subscribe = useCallback((callback: (event: WSEvent) => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  const subscribeToRepo = useCallback((repo: string) => {
    if (!subscribedReposRef.current.has(repo)) {
      wsService.subscribe(repo);
      subscribedReposRef.current.add(repo);
      console.log(`[useWebSocket] Subscribed to ${repo}`);
    }
  }, []);

  const subscribeToAllRepos = useCallback((repos: string[]) => {
    repos.forEach((repo) => {
      if (!subscribedReposRef.current.has(repo)) {
        wsService.subscribe(repo);
        subscribedReposRef.current.add(repo);
      }
    });
    console.log(`[useWebSocket] Subscribed to ${repos.length} repos: ${repos.join(', ')}`);
  }, []);

  const unsubscribeFromRepo = useCallback((repo: string) => {
    wsService.unsubscribe(repo);
    subscribedReposRef.current.delete(repo);
  }, []);

  const unsubscribeFromAllRepos = useCallback(() => {
    subscribedReposRef.current.forEach((repo) => {
      wsService.unsubscribe(repo);
    });
    subscribedReposRef.current.clear();
  }, []);

  useEffect(() => {
    const handleConnectionStatus = (connected: boolean) => {
      setIsConnected(connected);
      setWsConnected(connected);
      
      if (connected) {
        subscribedReposRef.current.forEach((repo) => {
          wsService.subscribe(repo);
        });
      }
    };

    const handleEvent = (event: WSEvent) => {
      listenersRef.current.forEach((listener) => listener(event));
    };

    const handlePRUpdate = (data: PullRequest) => {
      console.log('[useWebSocket] PR updated:', data.number, data.repoFullName);
      updatePullRequest(data);
    };

    const handlePipelineUpdate = (data: PipelineRun) => {
      console.log('[useWebSocket] Pipeline updated:', data.id, data.repoFullName);
      updatePipelineRun(data);
    };

    const handleWorkflowUpdate = (data: WorkflowRun & { repoFullName: string }) => {
      console.log('[useWebSocket] Workflow updated:', data.id, data.repoFullName);
      updateWorkflowRun(data);
    };

    const handleDeploymentComplete = (data: DeploymentStats) => {
      console.log('[WebSocket] Deployment completed:', data);
    };

    const unsub1 = wsService.on('connection:status', handleConnectionStatus);
    const unsub2 = wsService.on('pr:updated', handlePRUpdate);
    const unsub3 = wsService.on('pipeline:updated', handlePipelineUpdate);
    const unsub4 = wsService.on('workflow:updated', handleWorkflowUpdate);
    const unsub5 = wsService.on('deployment:completed', handleDeploymentComplete);
    const unsub6 = wsService.on('*', handleEvent);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
      unsubscribeFromAllRepos();
    };
  }, [updatePullRequest, updatePipelineRun, updateWorkflowRun, setWsConnected, unsubscribeFromAllRepos]);

  useEffect(() => {
    if (repoFullName && wsService.isConnected()) {
      subscribeToRepo(repoFullName);
    }
  }, [repoFullName, subscribeToRepo]);

  return {
    isConnected,
    connect,
    disconnect,
    subscribe,
    subscribeToRepo,
    subscribeToAllRepos,
    unsubscribeFromRepo,
    unsubscribeFromAllRepos,
  };
};

export default useWebSocket;
