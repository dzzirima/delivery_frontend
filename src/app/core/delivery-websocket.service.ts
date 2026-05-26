import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface DeliveryWsEvent {
  type: string;
  data: Record<string, unknown>;
}

const PING_INTERVAL_MS = 30_000; // 30 s — keeps user:online:web:{id} alive within the 60 s TTL

@Injectable({ providedIn: 'root' })
export class DeliveryWebSocketService {
  private client: Client | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly _events = new Subject<DeliveryWsEvent>();

  readonly events$ = this._events.asObservable();
  readonly connected = signal(false);

  constructor(private auth: AuthService) {}

  connect(): void {
    if (this.client?.connected) return;

    const token = this.auth.getToken();
    if (!token) return;

    const brokerURL = environment.wsUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')
      + `/ws?token=${encodeURIComponent(token)}&clientType=web`;

    this.client = new Client({
      brokerURL,
      reconnectDelay:    5000,
      heartbeatIncoming: 25000,
      heartbeatOutgoing: 25000,
      onConnect: () => {
        this.connected.set(true);
        this.client!.subscribe('/user/queue/delivery', msg => {
          try {
            const event = JSON.parse(msg.body) as DeliveryWsEvent;
            this._events.next(event);
          } catch { /* ignore malformed frames */ }
        });
        // Keep user:online:web:{id} alive in Redis
        this.startPing();
      },
      onDisconnect:  () => { this.connected.set(false); this.stopPing(); },
      onStompError:  () => { this.connected.set(false); this.stopPing(); },
      onWebSocketError: () => { this.connected.set(false); this.stopPing(); },
    });

    this.client.activate();
  }

  disconnect(): void {
    this.stopPing();
    this.client?.deactivate();
    this.client = null;
    this.connected.set(false);
  }

  private startPing(): void {
    this.stopPing();
    // Send immediately so the key is refreshed right after connect, then every 30 s
    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendPing(): void {
    if (this.client?.connected) {
      this.client.publish({ destination: '/app/ping' });
    }
  }
}
