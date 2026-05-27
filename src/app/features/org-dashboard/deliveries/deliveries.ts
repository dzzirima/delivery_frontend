import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe, CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrgDeliveryService, DeliveryItem, DeliveryStats, OrgRider } from './deliveries.service';
import { DeliveryWebSocketService } from '../../../core/delivery-websocket.service';
import { ToastService } from '../../../core/toast.service';
import { UserService } from '../../users/services/user.service';
import { DeliveryUiService } from './deliveries-ui.service';

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, CurrencyPipe, RouterModule],
  templateUrl: './deliveries.html',
})
export class Deliveries implements OnInit, OnDestroy {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  // ── Deliveries board ─────────────────────────────────────────────────────────
  deliveries        = signal<DeliveryItem[]>([]);
  deliveryStats     = signal<DeliveryStats | null>(null);
  deliveriesLoading = signal(false);
  deliveryFilter    = signal('');
  deliveryTotal     = signal(0);
  deliveryActioning = signal<string | null>(null);

  loadDeliveries() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.deliveriesLoading.set(true);
    const status = this.deliveryFilter() || undefined;
    this.orgDeliveryService.getBoard(orgId, status).subscribe({
      next: r => {
        this.deliveries.set(Array.isArray(r.data) ? r.data : []);
        this.deliveryTotal.set(r.length ?? 0);
        this.deliveriesLoading.set(false);
      },
      error: () => { this.deliveriesLoading.set(false); this.toast.error('Error', 'Failed to load deliveries.'); },
    });
    this.orgDeliveryService.getStats(orgId).subscribe({
      next: r => this.deliveryStats.set(r.data),
      error: () => {},
    });
  }

  cancelDelivery(id: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.deliveryActioning.set(id);
    this.orgDeliveryService.cancel(orgId, id).subscribe({
      next: () => { this.deliveryActioning.set(null); this.loadDeliveries(); this.toast.success('Success', 'Delivery cancelled.'); },
      error: (e) => { this.deliveryActioning.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to cancel.'); },
    });
  }

  publishDelivery(id: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.deliveryActioning.set(id);
    this.orgDeliveryService.publish(orgId, id).subscribe({
      next: () => { this.deliveryActioning.set(null); this.loadDeliveries(); this.toast.success('Success', 'Published to open bidding.'); },
      error: (e) => { this.deliveryActioning.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to publish.'); },
    });
  }

  deliveryStatusColor(status: string): string {
    const map: Record<string, string> = {
      ASSIGNED: '#f59e0b', ACCEPTED: '#3b82f6', IN_TRANSIT: '#8b5cf6',
      ARRIVED: '#06b6d4', DELIVERED: '#22c55e', DECLINED: '#ef4444',
      PUBLISHED: '#f97316', CANCELLED: '#6b7280',
    };
    return map[status] ?? '#6b7280';
  }

  openCreateDelivery() {
    this.deliveryUiService.open();
  }

  // ── Reassign ─────────────────────────────────────────────────────────────────
  deliveryDetailItem = signal<DeliveryItem | null>(null);
  reassignModal      = signal(false);
  reassignDriverId   = '';
  reassignModalError = signal('');

  openReassign(item: DeliveryItem) {
    this.deliveryDetailItem.set(item);
    this.reassignDriverId = '';
    this.reassignModalError.set('');
    this.loadOrgRiders();
    this.reassignModal.set(true);
  }
  closeReassign() { this.reassignModalError.set(''); this.reassignModal.set(false); }

  saveReassign() {
    const orgId = this.orgId();
    const item  = this.deliveryDetailItem();
    if (!orgId || !item || !this.reassignDriverId) return;
    this.deliveryActioning.set(item.id);
    this.orgDeliveryService.reassign(orgId, item.id, this.reassignDriverId).subscribe({
      next: () => { this.deliveryActioning.set(null); this.closeReassign(); this.loadDeliveries(); this.toast.success('Success', 'Reassigned successfully.'); },
      error: (e) => { this.deliveryActioning.set(null); this.reassignModalError.set(e?.error?.message ?? 'Failed to reassign.'); },
    });
  }

  // ── Org riders ───────────────────────────────────────────────────────────────
  orgRiders     = signal<OrgRider[]>([]);
  ridersLoading = signal(false);

  refreshOrgRiders() {
    this.orgRiders.set([]);
    this.loadOrgRiders();
  }

  loadOrgRiders() {
    const orgId = this.orgId();
    if (!orgId || this.orgRiders().length > 0) return;
    this.ridersLoading.set(true);
    this.orgDeliveryService.getRiders(orgId).subscribe({
      next:  r => { this.orgRiders.set(Array.isArray(r.data) ? r.data : []); this.ridersLoading.set(false); },
      error: () => { this.ridersLoading.set(false); },
    });
  }

  constructor(
    private orgDeliveryService:  OrgDeliveryService,
    private deliveryWsService:   DeliveryWebSocketService,
    private toast:               ToastService,
    private userService:         UserService,
    private deliveryUiService:   DeliveryUiService,
  ) {}

  ngOnInit() {
    this.loadDeliveries();
  }

  ngOnDestroy() {
    // WS lifecycle is managed by org-dashboard shell
  }
}
