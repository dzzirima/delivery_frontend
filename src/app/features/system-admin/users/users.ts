import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AdminUsersService, PlatformUser } from './users.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './users.html',
})
export class AdminUsers implements OnInit {
  readonly Math = Math;

  users      = signal<PlatformUser[]>([]);
  loading    = signal(false);
  totalCount = signal(0);
  page       = signal(0);

  readonly pageSize = 20;
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
  pageStart  = computed(() => this.totalCount() === 0 ? 0 : this.page() * this.pageSize + 1);
  pageEnd    = computed(() => Math.min((this.page() + 1) * this.pageSize, this.totalCount()));

  roleFilter  = signal('ALL');
  searchQuery = signal('');

  readonly ROLE_FILTERS = [
    { value: 'ALL',          label: 'All',          color: '#6b7280' },
    { value: 'SYSTEM_ADMIN', label: 'System Admin', color: '#6366f1' },
    { value: 'ORG_ADMIN',    label: 'Org Admin',    color: '#8b5cf6' },
    { value: 'DISPATCHER',   label: 'Dispatcher',   color: '#0ea5e9' },
    { value: 'RIDER',        label: 'Rider',        color: '#10b981' },
    { value: 'CUSTOMER',     label: 'Customer',     color: '#6b7280' },
  ];

  constructor(
    private usersService: AdminUsersService,
    private toast:        ToastService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const role = this.roleFilter() === 'ALL' ? undefined : this.roleFilter();
    this.usersService
      .list(this.page(), this.pageSize, role, this.searchQuery() || undefined)
      .subscribe({
        next: r => {
          this.users.set(r.data.content);
          this.totalCount.set(r.data.totalElements);
          this.loading.set(false);
        },
        error: () => { this.toast.error('Error', 'Failed to load users.'); this.loading.set(false); },
      });
  }

  setRoleFilter(value: string) {
    this.roleFilter.set(value);
    this.page.set(0);
    this.load();
  }

  search() {
    this.page.set(0);
    this.load();
  }

  clearSearch() {
    this.searchQuery.set('');
    this.page.set(0);
    this.load();
  }

  goToPage(p: number) {
    if (p < 0 || p >= this.totalPages()) return;
    this.page.set(p);
    this.load();
  }

  visiblePages(): number[] {
    const total = this.totalPages();
    const cur   = this.page();
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

  roleBadgeColor(role: string): string {
    const map: Record<string, string> = {
      SYSTEM_ADMIN: '#6366f1',
      ORG_ADMIN:    '#8b5cf6',
      DISPATCHER:   '#0ea5e9',
      RIDER:        '#10b981',
      CUSTOMER:     '#6b7280',
    };
    return map[role] ?? '#6b7280';
  }

  statusColor(status: string): string {
    return status === 'ACTIVE' ? '#16a34a' : '#ef4444';
  }
}
