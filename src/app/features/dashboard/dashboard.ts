import { Component, OnInit, signal, computed } from '@angular/core';
import { Orders } from '../orders/orders';
import { Customers } from '../customers/customers';
import { Riders } from '../riders/riders';
import { Analytics } from '../analytics/analytics';
import { Users } from '../users/users';
import { UserProfile } from '../user-profile/user-profile';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../users/services/user.service';

type Page = 'dashboard' | 'orders' | 'customers' | 'riders' | 'analytics' | 'users' | 'user-profile';

@Component({
  selector: 'app-dashboard',
  imports: [Orders, Customers, Riders, Analytics, Users, UserProfile],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  collapsed = signal(false);
  activePage = signal<Page>('dashboard');

  get currentUser() { return this.userService.profile; }

  initials = computed(() => {
    const name = this.userService.profile()?.name ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  });

  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  ngOnInit() {
    this.userService.getMyProfile().subscribe({ error: () => {} });
  }

  navigate(page: string) {
    this.activePage.set(page as Page);
  }

  toggleCollapsed() {
    this.collapsed.update(v => !v);
  }

  signOut() {
    this.authService.signOut();
  }
}
