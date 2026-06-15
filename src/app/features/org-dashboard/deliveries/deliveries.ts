import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe, TitleCasePipe, CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrgDeliveryService, DeliveryItem } from './deliveries.service';
import { ToastService } from '../../../core/toast.service';
import { UserService } from '../../../core/user.service';
import { DeliveryUiService } from './deliveries-ui.service';

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, CurrencyPipe, RouterModule],
  templateUrl: './deliveries.html',
})
export class Deliveries implements OnInit {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  deliveries = signal<DeliveryItem[]>([]);
  loading    = signal(false);

  constructor(
    private orgDeliveryService: OrgDeliveryService,
    private toast:              ToastService,
    private userService:        UserService,
    private deliveryUiService:  DeliveryUiService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.orgDeliveryService.getBoard().subscribe({
      next:  r => { this.deliveries.set(Array.isArray(r.data) ? r.data : []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Error', 'Failed to load deliveries.'); },
    });
  }

  openCreate() {
    this.deliveryUiService.open();
  }

  statusColor(status: string): string {
    const map: Record<string, string> = {
      ASSIGNED:   '#f59e0b',
      ACCEPTED:   '#3b82f6',
      IN_TRANSIT: '#8b5cf6',
      ARRIVED:    '#06b6d4',
      DELIVERED:  '#22c55e',
      DECLINED:   '#ef4444',
      PUBLISHED:  '#f97316',
      CANCELLED:  '#6b7280',
    };
    return map[status] ?? '#6b7280';
  }
}
