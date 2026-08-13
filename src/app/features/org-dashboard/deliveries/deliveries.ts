import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { TitleCasePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrgDeliveryService, DeliveryItem, DeliveryStats } from './deliveries.service';
import { ToastService } from '../../../core/toast.service';
import { UserService } from '../../../core/user.service';
import { DeliveryUiService } from './deliveries-ui.service';
import { DeliveryWebSocketService } from '../../../core/delivery-websocket.service';

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [TitleCasePipe, CurrencyPipe, DecimalPipe, RouterModule],
  templateUrl: './deliveries.html',
})
export class Deliveries implements OnInit, OnDestroy {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  deliveries   = signal<DeliveryItem[]>([]);
  loading      = signal(false);
  stats        = signal<DeliveryStats | null>(null);
  statusFilter = signal<string>('ALL');

  // Action state
  actionInFlight = signal<string | null>(null); // deliveryId being acted on
  showCancelId   = signal<string | null>(null);
  showPublishId  = signal<string | null>(null);

  readonly STATUS_FILTERS = [
    { value: 'ALL',        label: 'All',        color: '#6b7280' },
    { value: 'PUBLISHED',  label: 'Published',  color: '#f97316' },
    { value: 'ASSIGNED',   label: 'Assigned',   color: '#f59e0b' },
    { value: 'ACCEPTED',   label: 'Accepted',   color: '#3b82f6' },
    { value: 'IN_TRANSIT', label: 'In Transit', color: '#8b5cf6' },
    { value: 'ARRIVED',    label: 'Arrived',    color: '#10b981' },
    { value: 'DECLINED',   label: 'Declined',   color: '#ef4444' },
    { value: 'DELIVERED',  label: 'Delivered',  color: '#16a34a' },
    { value: 'CANCELLED',  label: 'Cancelled',  color: '#6b7280' },
  ];

  filteredDeliveries = computed(() => {
    const f = this.statusFilter();
    if (f === 'ALL') return this.deliveries();
    return this.deliveries().filter(d => d.status === f);
  });

  activeCount = computed(() => {
    const s = this.stats();
    if (!s) return 0;
    return (s.assigned ?? 0) + (s.accepted ?? 0) + (s.inTransit ?? 0);
  });

  private boardSub: Subscription | null = null;

  constructor(
    private orgDeliveryService: OrgDeliveryService,
    private toast:              ToastService,
    private userService:        UserService,
    private deliveryUiService:  DeliveryUiService,
    private ws:                 DeliveryWebSocketService,
  ) {}

  ngOnInit() {
    this.load();
    this.loadStats();

    // Real-time board updates
    this.boardSub = this.ws.boardEvents$.subscribe(evt => {
      const data = evt.data as Record<string, unknown>;
      const id   = String(data['id'] ?? data['deliveryId'] ?? '');
      if (!id) return;

      // Patch the item in the list if it exists, otherwise prepend it
      const newStatus = String(data['status'] ?? '');
      this.deliveries.update(list => {
        const idx = list.findIndex(d => d.id === id);
        if (idx >= 0) {
          const updated = { ...list[idx], status: newStatus || list[idx].status };
          // Pull updated fields from socket payload
          if (data['driverName'])  (updated as DeliveryItem).driverName  = String(data['driverName']);
          if (data['driverId'])    (updated as DeliveryItem).driverId    = String(data['driverId']);
          const next = [...list];
          next[idx]  = updated;
          return next;
        }
        return list;
      });
      // Refresh stats on any board event
      this.loadStats();
    });

    // Org dispatch topic is subscribed once by the OrgDashboard shell.
  }

  ngOnDestroy() {
    this.boardSub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    const f = this.statusFilter();
    this.orgDeliveryService.getBoard(f === 'ALL' ? undefined : f).subscribe({
      next:  r => { this.deliveries.set(Array.isArray(r.data) ? r.data : []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Error', 'Failed to load deliveries.'); },
    });
  }

  loadStats() {
    this.orgDeliveryService.getStats().subscribe({
      next:  r => this.stats.set(r.data),
      error: () => {},
    });
  }

  setFilter(value: string) {
    this.statusFilter.set(value);
    this.load();
  }

  openCreate() {
    this.deliveryUiService.open();
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  canCancel(item: DeliveryItem): boolean {
    return !['DELIVERED', 'CANCELLED', 'FAILED', 'IN_TRANSIT'].includes(item.status);
  }

  canPublish(item: DeliveryItem): boolean {
    return ['ASSIGNED', 'DECLINED'].includes(item.status);
  }

  cancelDelivery(id: string) {
    this.showCancelId.set(null);
    this.actionInFlight.set(id);
    this.orgDeliveryService.cancel(id).subscribe({
      next: () => {
        this.actionInFlight.set(null);
        this.toast.success('Cancelled', 'Delivery cancelled.');
        this.load(); this.loadStats();
      },
      error: e => {
        this.actionInFlight.set(null);
        this.toast.error('Error', e?.error?.message ?? 'Failed to cancel delivery.');
      },
    });
  }

  publishDelivery(id: string) {
    this.showPublishId.set(null);
    this.actionInFlight.set(id);
    this.orgDeliveryService.publish(id).subscribe({
      next: () => {
        this.actionInFlight.set(null);
        this.toast.success('Published', 'Delivery published to open bidding.');
        this.load(); this.loadStats();
      },
      error: e => {
        this.actionInFlight.set(null);
        this.toast.error('Error', e?.error?.message ?? 'Failed to publish delivery.');
      },
    });
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  statusColor(status: string): string {
    const map: Record<string, string> = {
      CREATED:    '#f97316',
      PUBLISHED:  '#f97316',
      ASSIGNED:   '#f59e0b',
      ACCEPTED:   '#3b82f6',
      IN_TRANSIT: '#8b5cf6',
      ARRIVED:    '#10b981',
      DELIVERED:  '#16a34a',
      DECLINED:   '#ef4444',
      CANCELLED:  '#6b7280',
    };
    return map[status] ?? '#6b7280';
  }

  strategyLabel(s: string | null): string {
    if (!s) return '';
    const m: Record<string, string> = {
      DIRECT_ASSIGN: 'Direct',
      INTERNAL_BID:  'Int. Bid',
      PUBLIC_BID:    'Public',
    };
    return m[s] ?? s;
  }

  strategyColor(s: string | null): string {
    const m: Record<string, string> = {
      DIRECT_ASSIGN: '#3b82f6',
      INTERNAL_BID:  '#8b5cf6',
      PUBLIC_BID:    '#f97316',
    };
    return m[s ?? ''] ?? '#6b7280';
  }

  timeElapsed(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  isHighPriority(p: string | null): boolean {
    return p === 'HIGH' || p === 'URGENT';
  }
}
