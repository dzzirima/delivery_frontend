import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';
import { DeliveryWebSocketService, DriverStatusEvent } from '../../core/delivery-websocket.service';
import { ToastService } from '../../core/toast.service';
import { NotificationService } from '../../core/notification.service';
import { NotificationDrawer } from '../../shared/notification-drawer/notification-drawer';
import { CreateDeliveryModal } from './deliveries/create-delivery-modal/create-delivery-modal';

@Component({
  selector: 'app-org-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CreateDeliveryModal, NotificationDrawer],
  templateUrl: './org-dashboard.html',
})
export class OrgDashboard implements OnInit, OnDestroy {
  collapsed = signal(false);

  get currentUser() { return this.userService.profile; }
  get isOrgAdmin()  { return this.authService.getRole() === 'ORG_ADMIN'; }

  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  initials = computed(() => {
    const name = this.userService.profile()?.name ?? '';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  });

  readonly baseNavItems = [
    { id: 'overview',   route: 'overview',   label: 'Overview',    icon: 'home',      adminOnly: false },
    { id: 'deliveries', route: 'deliveries', label: 'Deliveries',  icon: 'bolt',      adminOnly: false },
    { id: 'fleet',      route: 'fleet',      label: 'Fleet',       icon: 'truck',     adminOnly: true  },
    { id: 'members',    route: 'members',    label: 'Members',     icon: 'users',     adminOnly: true  },
    { id: 'clients',    route: 'clients',    label: 'Clients',     icon: 'user-plus', adminOnly: false },
    { id: 'shops',      route: 'shops',      label: 'Shops',       icon: 'store',     adminOnly: true  },
    { id: 'settings',   route: 'settings',   label: 'Settings',    icon: 'cog',       adminOnly: true  },
  ];

  get navItems() {
    return this.baseNavItems.filter(i => !i.adminOnly || this.isOrgAdmin);
  }

  // ── Global WebSocket subscriptions ────────────────────────────────────────────
  // These live here so toast notifications fire regardless of which page is active.
  private boardSub:        Subscription | null = null;
  private driverStatusSub: Subscription | null = null;

  constructor(
    private authService:          AuthService,
    private userService:          UserService,
    private ws:                   DeliveryWebSocketService,
    private toast:                ToastService,
    readonly notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.ws.connect();

    this.notificationService.init();

    // Subscribe to this org's dispatch topic once, at the shell level.
    // All child components (overview, delivery-detail, etc.) receive events from
    // the shared Subject without needing their own STOMP subscriptions.
    const orgId = this.orgId();
    if (orgId) this.ws.subscribeToOrgDispatch(orgId);

    // ── Delivery event toasts ─────────────────────────────────────────────────
    // Fires on every screen — admin always knows what's happening.
    this.boardSub = this.ws.boardEvents$.subscribe(evt => {
      const data     = evt.data as Record<string, unknown>;
      const evtId    = String(data['id'] ?? data['deliveryId'] ?? '');
      const status   = String(data['status'] ?? '');
      const rider    = data['driverName'] ? String(data['driverName']) : null;
      const shortId  = evtId ? `#${evtId.slice(-6).toUpperCase()}` : '';

      switch (evt.type) {
        case 'dispatchAcceptedEvent':
          this.toast.success('Delivery Accepted',
            rider ? `${rider} accepted delivery ${shortId}` : `Delivery ${shortId} accepted`);
          break;

        case 'dispatchDeclinedEvent':
          this.toast.warning('Delivery Declined',
            rider ? `${rider} declined ${shortId} — reassign needed` : `Delivery ${shortId} declined`);
          break;

        case 'dispatchStatusUpdatedEvent':
          if (status === 'IN_TRANSIT')
            this.toast.info('Picked Up',
              rider ? `${rider} picked up ${shortId} and is on the way` : `Delivery ${shortId} in transit`);
          else if (status === 'ARRIVED')
            this.toast.info('Arrived',
              rider ? `${rider} arrived at dropoff for ${shortId}` : `Delivery ${shortId} arrived`);
          else if (status === 'DELIVERED')
            this.toast.success('Delivered \u2713',
              rider ? `${rider} completed delivery ${shortId}` : `Delivery ${shortId} completed`);
          break;

        case 'dispatchCancelledEvent':
          this.toast.warning('Delivery Cancelled', `Delivery ${shortId} has been cancelled`);
          break;

        case 'dispatchReassignedEvent':
          this.toast.info('Rider Reassigned',
            rider ? `${rider} reassigned to ${shortId}` : `Delivery ${shortId} reassigned`);
          break;

        case 'dispatchPublishedEvent':
          this.toast.info('Published', `Delivery ${shortId} published for open bidding`);
          break;
      }
    });

    // ── Rider online / offline toasts ─────────────────────────────────────────
    this.driverStatusSub = this.ws.driverStatus$.subscribe((evt: DriverStatusEvent) => {
      if (!evt.riderId) return;
      const name = evt.riderName ?? 'Rider';
      if (evt.status === 'OFFLINE') {
        this.toast.warning('Rider Offline', `${name} has gone offline`);
      } else {
        this.toast.info('Rider Online', `${name} is back online`);
      }
    });
  }

  ngOnDestroy() {
    this.boardSub?.unsubscribe();
    this.driverStatusSub?.unsubscribe();
    this.ws.unsubscribeFromOrgDispatch();
    this.ws.disconnect();
    this.notificationService.destroy();
  }

  toggleCollapsed() {
    this.collapsed.update(v => !v);
  }

  signOut() {
    this.authService.signOut();
  }

  onDeliveryCreated() {
    // Deliveries board refreshes itself via the created event on the deliveries page
  }
}
