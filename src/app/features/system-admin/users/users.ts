import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { AdminUsersService, PlatformUser } from './users.service';
import { ToastService } from '../../../core/toast.service';

const ROLES = ['', 'SYSTEM_ADMIN', 'ORG_ADMIN', 'DISPATCHER', 'RIDER', 'CUSTOMER'];

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './users.html',
})
export class AdminUsers implements OnInit {

  users         = signal<PlatformUser[]>([]);
  loading       = signal(false);
  totalElements = signal(0);
  totalPages    = signal(0);
  page          = signal(0);
  readonly size = 20;

  readonly roleOptions = ROLES;
  selectedRole  = '';
  searchDraft   = '';
  searchQuery   = signal('');

  constructor(
    private usersService: AdminUsersService,
    private toast:        ToastService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.usersService
      .list(this.page(), this.size, this.selectedRole || undefined, this.searchQuery() || undefined)
      .subscribe({
        next: r => {
          this.users.set(r.data.content);
          this.totalElements.set(r.data.totalElements);
          this.totalPages.set(r.data.totalPages);
          this.loading.set(false);
        },
        error: () => { this.toast.error('Error', 'Failed to load users.'); this.loading.set(false); },
      });
  }

  applyFilters() {
    this.page.set(0);
    this.load();
  }

  search() {
    this.searchQuery.set(this.searchDraft.trim());
    this.page.set(0);
    this.load();
  }

  clearSearch() {
    this.searchDraft = '';
    this.searchQuery.set('');
    this.page.set(0);
    this.load();
  }

  goToPage(p: number) {
    if (p < 0 || p >= this.totalPages()) return;
    this.page.set(p);
    this.load();
  }

  roleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      ADMIN:      'bg-indigo-100 text-indigo-700',
      ORG_ADMIN:  'bg-violet-100 text-violet-700',
      DISPATCHER: 'bg-sky-100 text-sky-700',
      RIDER:      'bg-emerald-100 text-emerald-700',
      CUSTOMER:   'bg-gray-100 text-gray-600',
    };
    return map[role] ?? 'bg-gray-100 text-gray-500';
  }

  statusBadgeClass(status: string): string {
    return status === 'ACTIVE'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';
  }
}
