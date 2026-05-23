import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface DeliveryWsEvent {
  type: string;
  data: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class DeliveryWebSocketService {
  private client: Client | null = null;
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
      + `/ws?token=${encodeURIComponent(token)}`;

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
      },
      onDisconnect:  () => this.connected.set(false),
      onStompError:  () => this.connected.set(false),
      onWebSocketError: () => this.connected.set(false),
    });

    this.client.activate();
  }

  disconnect(): void {
    this.client?.deactivate();
    this.client = null;
    this.connected.set(false);
  }
}
