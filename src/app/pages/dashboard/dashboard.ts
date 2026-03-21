import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Orders } from '../../features/orders/orders';
import { Customers } from '../../features/customers/customers';
import { Riders } from '../../features/riders/riders';
import { Analytics } from '../../features/analytics/analytics';
import { Users } from '../../features/users/users';
import { AuthService } from '../../core/auth.service';

type Page = 'dashboard' | 'orders' | 'customers' | 'riders' | 'analytics' | 'users';

@Component({
  selector: 'app-dashboard',
  imports: [Orders, Customers, Riders, Analytics, Users],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  collapsed = signal(false);
  activePage = signal<Page>('dashboard');

  constructor(private router: Router, private authService: AuthService) {}

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
