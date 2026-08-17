import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { TitleCasePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { OrgDeliveryService, DeliveryItem, DeliveryStats } from '../../org-dashboard/deliveries/deliveries.service';
import { ToastService } from '../../../core/toast.service';
import { DeliveryWebSocketService } from '../../../core/delivery-websocket.service';

@Component({
  selector: 'app-admin-deliveries',
  standalone: true,
  imports: [TitleCasePipe, CurrencyPipe, DecimalPipe, RouterModule, FormsModule],
  templateUrl: './admin-deliveries.html',
})
export class AdminDeliveries implements OnInit, OnDestroy {
  readonly Math = Math;

  deliveries   = signal<DeliveryItem[]>([]);
  loading      = signal(false);
  stats        = signal<DeliveryStats | null>(null);
  statusFilter = signal<string>('ALL');

  searchQuery = signal('');
  fromDate    = signal('');
  toDate      = signal('');

  currentPage = signal(0);
  totalCount  = signal(0);
  readonly pageSize = 30;
  totalPages  = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
  pageStart   = computed(() => this.totalCount() === 0 ? 0 : this.currentPage() * this.pageSize + 1);
  pageEnd     = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.totalCount()));

  actionInFlight = signal<string | null>(null);

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

  activeCount = computed(() => {
    const s = this.stats();
    if (!s) return 0;
    return (s.assigned ?? 0) + (s.accepted ?? 0) + (s.inTransit ?? 0);
  });

  private boardSub: Subscription | null = null;

  constructor(
    private deliveryService: OrgDeliveryService,
    private toast:           ToastService,
    private ws:              DeliveryWebSocketService,
  ) {}

  ngOnInit() {
    this.load();
    this.loadStats();

    this.boardSub = this.ws.boardEvents$.subscribe(evt => {
      const data = evt.data as Record<string, unknown>;
      const id   = String(data['id'] ?? data['deliveryId'] ?? '');
      if (!id) return;
      const newStatus = String(data['status'] ?? '');
      this.deliveries.update(list => {
        const idx = list.findIndex(d => d.id === id);
        if (idx >= 0) {
          const updated = { ...list[idx], status: newStatus || list[idx].status };
          if (data['driverName']) (updated as DeliveryItem).driverName = String(data['driverName']);
          if (data['driverId'])   (updated as DeliveryItem).driverId   = String(data['driverId']);
          const next = [...list]; next[idx] = updated; return next;
        }
        return list;
      });
      this.loadStats();
    });
  }

  ngOnDestroy() { this.boardSub?.unsubscribe(); }

  load() {
    this.loading.set(true);
    const status = this.statusFilter() === 'ALL' ? undefined : this.statusFilter();
    this.deliveryService
      .getBoard(status, this.currentPage(), this.pageSize, this.searchQuery(), this.fromDate(), this.toDate())
      .subscribe({
        next: r => {
          this.deliveries.set(Array.isArray(r.data) ? r.data : []);
          this.totalCount.set(r.length ?? 0);
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); this.toast.error('Error', 'Failed to load deliveries.'); },
      });
  }

  loadStats() {
    this.deliveryService.getStats().subscribe({
      next:  r => this.stats.set(r.data),
      error: () => {},
    });
  }

  setFilter(value: string) {
    this.statusFilter.set(value);
    this.currentPage.set(0);
    this.load();
  }

  search() {
    this.currentPage.set(0);
    this.load();
  }

  clearFilters() {
    this.searchQuery.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.currentPage.set(0);
    this.load();
  }

  goToPage(page: number) {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.load();
  }

  visiblePages(): number[] {
    const total = this.totalPages();
    const cur   = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const pages: number[] = [];
    pages.push(0);
    const lo = Math.max(1, cur - 2);
    const hi = Math.min(total - 2, cur + 2);
    if (lo > 1) pages.push(-1);
    for (let i = lo; i <= hi; i++) pages.push(i);
    if (hi < total - 2) pages.push(-1);
    pages.push(total - 1);
    return pages;
  }

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
    return { DIRECT_ASSIGN: 'Direct', INTERNAL_BID: 'Int. Bid', PUBLIC_BID: 'Public' }[s] ?? s;
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

  cancelDelivery(id: string) {
    this.actionInFlight.set(id);
    this.deliveryService.cancel(id).subscribe({
      next: () => { this.actionInFlight.set(null); this.load(); this.loadStats(); },
      error: e => {
        this.actionInFlight.set(null);
        this.toast.error('Error', e?.error?.message ?? 'Failed to cancel delivery.');
      },
    });
  }
}
