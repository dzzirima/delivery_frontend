import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface DeliveryWsEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface RiderLocationEvent {
  riderId:    string;
  deliveryId: string | null;
  lat:        number;
  lng:        number;
  bearing:    number | null;
  status:     string | null;
}

export interface DriverStatusEvent {
  riderId:    string;
  riderName:  string | null;
  /** "ONLINE" | "OFFLINE" */
  status:     string;
  lat:        number | null;
  lng:        number | null;
  lastSeenTs: number;
  deliveryId: string | null;
}

const PING_INTERVAL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class DeliveryWebSocketService {
  private client:       Client | null = null;
  private pingTimer:    ReturnType<typeof setInterval> | null = null;
  private orgSub:       StompSubscription | null = null;
  private pendingOrgId: string | null = null;

  private readonly _events              = new Subject<DeliveryWsEvent>();
  private readonly _boardEvents         = new Subject<DeliveryWsEvent>();
  private readonly _riderLocations      = new Subject<RiderLocationEvent>();
  private readonly _driverStatus        = new Subject<DriverStatusEvent>();
  private readonly _notificationEvents  = new Subject<DeliveryWsEvent>();

  /** Personal queue events (bidding flow). */
  readonly events$              = this._events.asObservable();
  /** Org dispatch board events (status changes, reassign, cancel, etc.). */
  readonly boardEvents$         = this._boardEvents.asObservable();
  /** Live rider GPS events from the org dispatch topic. */
  readonly riderLocations$      = this._riderLocations.asObservable();
  /** Driver ONLINE / OFFLINE status events from the org dispatch topic. */
  readonly driverStatus$        = this._driverStatus.asObservable();
  /** Per-user persistent notification events. */
  readonly notificationEvents$  = this._notificationEvents.asObservable();
  readonly connected            = signal(false);

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

        // Personal queue — bid / direct-assign events
        this.client!.subscribe('/user/queue/delivery', msg => {
          try {
            const event = JSON.parse(msg.body) as DeliveryWsEvent;
            this._events.next(event);
          } catch { /* ignore malformed frames */ }
        });

        // Per-user notification topic
        const userId = this.auth.userId();
        if (userId) {
          this.client!.subscribe(`/topic/notifications/${userId}`, msg => {
            try {
              const event = JSON.parse(msg.body) as DeliveryWsEvent;
              this._notificationEvents.next(event);
            } catch { /* ignore malformed frames */ }
          });
        }

        // Re-subscribe to org topic after reconnect
        if (this.pendingOrgId) {
          this._doSubscribeToOrg(this.pendingOrgId);
        }

        this.startPing();
      },
      onDisconnect:     () => { this.connected.set(false); this.stopPing(); },
      onStompError:     () => { this.connected.set(false); this.stopPing(); },
      onWebSocketError: () => { this.connected.set(false); this.stopPing(); },
    });

    this.client.activate();
  }

  /**
   * Subscribe to the org-level dispatch topic.
   * Safely queues the subscription when called before connect().
   * Automatically resubscribes after reconnect.
   */
  subscribeToOrgDispatch(orgId: string): void {
    this.pendingOrgId = orgId;
    if (this.client?.connected) {
      this._doSubscribeToOrg(orgId);
    }
  }

  unsubscribeFromOrgDispatch(): void {
    this.orgSub?.unsubscribe();
    this.orgSub       = null;
    this.pendingOrgId = null;
  }

  private _doSubscribeToOrg(orgId: string): void {
    this.orgSub?.unsubscribe();
    this.orgSub = this.client!.subscribe(`/topic/org/${orgId}/dispatch`, msg => {
      try {
        const event = JSON.parse(msg.body) as DeliveryWsEvent;
        if (event.type === 'riderLocationEvent') {
          const d = event.data as Record<string, unknown>;
          this._riderLocations.next({
            riderId:    String(d['riderId']    ?? ''),
            deliveryId: d['deliveryId'] != null ? String(d['deliveryId']) : null,
            lat:        Number(d['lat']        ?? 0),
            lng:        Number(d['lng']        ?? 0),
            bearing:    d['bearing'] != null   ? Number(d['bearing'])     : null,
            status:     d['status']  != null   ? String(d['status'])      : null,
          });
        } else if (event.type === 'driverStatusEvent') {
          const d = event.data as Record<string, unknown>;
          this._driverStatus.next({
            riderId:    String(d['riderId']    ?? ''),
            riderName:  d['riderName'] != null  ? String(d['riderName'])  : null,
            status:     String(d['status']     ?? 'OFFLINE'),
            lat:        d['lat']       != null  ? Number(d['lat'])         : null,
            lng:        d['lng']       != null  ? Number(d['lng'])         : null,
            lastSeenTs: Number(d['lastSeenTs'] ?? 0),
            deliveryId: d['deliveryId'] != null ? String(d['deliveryId']) : null,
          });
        } else {
          this._boardEvents.next(event);
        }
      } catch { /* ignore malformed frames */ }
    });
  }

  disconnect(): void {
    this.stopPing();
    this.orgSub?.unsubscribe();
    this.orgSub = null;
    this.client?.deactivate();
    this.client = null;
    this.connected.set(false);
  }

  private startPing(): void {
    this.stopPing();
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
