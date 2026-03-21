import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Orders } from '../../features/orders/orders';
import { Customers } from '../../features/customers/customers';
import { Riders } from '../../features/riders/riders';
import { Analytics } from '../../features/analytics/analytics';

type Page = 'dashboard' | 'orders' | 'customers' | 'riders' | 'analytics';

@Component({
  selector: 'app-dashboard',
  imports: [Orders, Customers, Riders, Analytics],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  collapsed = signal(false);
  activePage = signal<Page>('dashboard');

  constructor(private router: Router) {}

  navigate(page: Page) {
    this.activePage.set(page);
  }

  signOut() {
    this.router.navigate(['/signin']);
  }
}
