import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { DeliveryWebSocketService } from './delivery-websocket.service';

export interface NotificationItem {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  data:      string | null;
  read:      boolean;
  createdAt: string;
}

interface ApiListResponse {
  data:    NotificationItem[];
  length:  number;
  success: boolean;
}

interface ApiCountResponse {
  data:    { count: number };
  success: boolean;
}

const PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<NotificationItem[]>([]);
  readonly unreadCount   = signal(0);
  readonly drawerOpen    = signal(false);
  readonly loading       = signal(false);
  readonly hasMore       = signal(true);

  private page     = 0;
  private wsSub:   Subscription | null = null;

  constructor(
    private http: HttpClient,
    private ws:   DeliveryWebSocketService,
  ) {}

  /** Call once from the shell (org-dashboard) after WS is connected. */
  init(): void {
    this.fetchUnreadCount();
    this.fetchPage(0, true);

    this.wsSub = this.ws.notificationEvents$.subscribe(evt => {
      if (evt.type !== 'notificationEvent') return;
      const item = evt.data as unknown as NotificationItem;
      this.notifications.update(list => [item, ...list]);
      this.unreadCount.update(c => c + 1);
    });
  }

  destroy(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = null;
  }

  openDrawer():  void { this.drawerOpen.set(true);  }
  closeDrawer(): void { this.drawerOpen.set(false); }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.fetchPage(++this.page, false);
  }

  markRead(id: string): void {
    this.http.put(`${environment.apiUrl}/notifications/${id}/read`, {}).subscribe();
    this.notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
    this.unreadCount.update(c => Math.max(0, c - 1));
  }

  markAllRead(): void {
    this.http.put(`${environment.apiUrl}/notifications/mark-all-read`, {}).subscribe();
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.unreadCount.set(0);
  }

  private fetchPage(page: number, reset: boolean): void {
    this.loading.set(true);
    this.http
      .get<ApiListResponse>(
        `${environment.apiUrl}/notifications?page=${page}&size=${PAGE_SIZE}`
      )
      .subscribe({
        next: res => {
          const items = res.data ?? [];
          if (reset) {
            this.notifications.set(items);
          } else {
            this.notifications.update(list => [...list, ...items]);
          }
          this.hasMore.set(items.length === PAGE_SIZE);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private fetchUnreadCount(): void {
    this.http
      .get<ApiCountResponse>(`${environment.apiUrl}/notifications/unread-count`)
      .subscribe({ next: res => this.unreadCount.set(res.data?.count ?? 0) });
  }
}
