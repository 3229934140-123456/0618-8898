import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { WSEvent, PullRequest, PipelineRun, WorkflowRun, DeploymentStats } from '../../shared/types.js';

let io: Server | null = null;

export const initWebSocket = (server: HTTPServer): Server => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    socket.on('subscribe', (repoFullName: string) => {
      socket.join(repoFullName);
      console.log(`[WebSocket] Client ${socket.id} subscribed to ${repoFullName}`);
    });

    socket.on('unsubscribe', (repoFullName: string) => {
      socket.leave(repoFullName);
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from ${repoFullName}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const broadcastEvent = (event: WSEvent, repoFullName?: string): void => {
  if (!io) return;

  if (repoFullName) {
    io.to(repoFullName).emit(event.type, event.data);
    console.log(`[WebSocket] Broadcast ${event.type} to ${repoFullName}`);
  } else {
    io.emit(event.type, event.data);
    console.log(`[WebSocket] Broadcast ${event.type} to all clients`);
  }
};

export const broadcastPRUpdate = (pr: PullRequest): void => {
  broadcastEvent({ type: 'pr:updated', data: pr }, pr.repoFullName);
};

export const broadcastPipelineUpdate = (pipeline: PipelineRun): void => {
  broadcastEvent({ type: 'pipeline:updated', data: pipeline }, pipeline.repoFullName);
};

export const broadcastWorkflowUpdate = (run: WorkflowRun & { repoFullName: string }): void => {
  broadcastEvent({ type: 'workflow:updated', data: run }, run.repoFullName);
};

export const broadcastDeploymentComplete = (stats: DeploymentStats): void => {
  broadcastEvent({ type: 'deployment:completed', data: stats }, stats.repoName);
};
