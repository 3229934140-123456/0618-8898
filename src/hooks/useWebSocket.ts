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

  const subscribedRef = useRef<string | null>(null);
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
    if (subscribedRef.current && subscribedRef.current !== repo) {
      wsService.unsubscribe(subscribedRef.current);
    }
    wsService.subscribe(repo);
    subscribedRef.current = repo;
  }, []);

  const unsubscribeFromRepo = useCallback((repo: string) => {
    wsService.unsubscribe(repo);
    if (subscribedRef.current === repo) {
      subscribedRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleConnectionStatus = (connected: boolean) => {
      setIsConnected(connected);
      setWsConnected(connected);
    };

    const handleEvent = (event: WSEvent) => {
      listenersRef.current.forEach((listener) => listener(event));
    };

    const handlePRUpdate = (data: PullRequest) => {
      updatePullRequest(data);
    };

    const handlePipelineUpdate = (data: PipelineRun) => {
      updatePipelineRun(data);
    };

    const handleWorkflowUpdate = (data: WorkflowRun & { repoFullName: string }) => {
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

      if (subscribedRef.current) {
        wsService.unsubscribe(subscribedRef.current);
      }
    };
  }, [updatePullRequest, updatePipelineRun, updateWorkflowRun, setWsConnected]);

  useEffect(() => {
    if (repoFullName && wsService.isConnected()) {
      if (subscribedRef.current && subscribedRef.current !== repoFullName) {
        wsService.unsubscribe(subscribedRef.current);
      }
      wsService.subscribe(repoFullName);
      subscribedRef.current = repoFullName;
    }
  }, [repoFullName]);

  return {
    isConnected,
    connect,
    disconnect,
    subscribe,
    subscribeToRepo,
    unsubscribeFromRepo,
  };
};

export default useWebSocket;
