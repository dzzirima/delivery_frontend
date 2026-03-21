import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

type Page = 'dashboard' | 'deliveries' | 'customers' | 'riders' | 'analytics';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  collapsed = signal(false);
  activePage = signal<Page>('dashboard');

  navItems: { id: Page; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'deliveries', label: 'Deliveries' },
    { id: 'customers', label: 'Customers' },
    { id: 'riders', label: 'Riders' },
    { id: 'analytics', label: 'Analytics' },
  ];

  constructor(private router: Router) {}

  toggleSidebar() {
    this.collapsed.update(v => !v);
  }

  navigate(page: Page) {
    this.activePage.set(page);
  }

  signOut() {
    this.router.navigate(['/signin']);
  }
}
