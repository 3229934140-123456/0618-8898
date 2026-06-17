import { io, Socket } from 'socket.io-client';
import type { WSEvent, PullRequest, PipelineRun, WorkflowRun, DeploymentStats } from '../../shared/types.js';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

type EventCallback<T = any> = (data: T) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
      this.emit('connection:status', true);
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      this.emit('connection:status', false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
      }
    });

    this.socket.on('pr:updated', (data: PullRequest) => {
      this.emit('pr:updated', data);
    });

    this.socket.on('pipeline:updated', (data: PipelineRun) => {
      this.emit('pipeline:updated', data);
    });

    this.socket.on('workflow:updated', (data: WorkflowRun & { repoFullName: string }) => {
      this.emit('workflow:updated', data);
    });

    this.socket.on('deployment:completed', (data: DeploymentStats) => {
      this.emit('deployment:completed', data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(repoFullName: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe', repoFullName);
      console.log(`[WebSocket] Subscribed to ${repoFullName}`);
    }
  }

  unsubscribe(repoFullName: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', repoFullName);
      console.log(`[WebSocket] Unsubscribed from ${repoFullName}`);
    }
  }

  on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any): void {
    const wsEvent: WSEvent = { type: event as any, data } as any;
    
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WebSocket] Error in listener for ${event}:`, error);
      }
    });
    
    this.listeners.get('*')?.forEach(callback => {
      try {
        callback(wsEvent);
      } catch (error) {
        console.error(`[WebSocket] Error in wildcard listener:`, error);
      }
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const wsService = new WebSocketService();
export default wsService;
