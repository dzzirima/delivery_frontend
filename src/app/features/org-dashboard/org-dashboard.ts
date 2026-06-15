import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';
import { DeliveryWebSocketService } from '../../core/delivery-websocket.service';
import { CreateDeliveryModal } from './deliveries/create-delivery-modal/create-delivery-modal';

@Component({
  selector: 'app-org-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CreateDeliveryModal],
  templateUrl: './org-dashboard.html',
})
export class OrgDashboard implements OnInit, OnDestroy {
  collapsed = signal(false);

  get currentUser() { return this.userService.profile; }
  get isOrgAdmin()  { return this.authService.getRole() === 'ORG_ADMIN'; }

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

  constructor(
    private authService:         AuthService,
    private userService:         UserService,
    private deliveryWsService:   DeliveryWebSocketService,
  ) {}

  ngOnInit() {
    this.deliveryWsService.connect();
  }

  ngOnDestroy() {
    this.deliveryWsService.disconnect();
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
