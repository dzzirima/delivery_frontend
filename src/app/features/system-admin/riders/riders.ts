import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AdminRidersService, PlatformRider } from './riders.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-admin-riders',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './riders.html',
})
export class AdminRiders implements OnInit {

  riders        = signal<PlatformRider[]>([]);
  loading       = signal(false);
  totalElements = signal(0);
  totalPages    = signal(0);
  page          = signal(0);
  readonly size = 20;

  searchQuery = signal('');
  searchDraft = '';

  constructor(
    private ridersService: AdminRidersService,
    private toast:         ToastService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.ridersService.list(this.page(), this.size, this.searchQuery() || undefined).subscribe({
      next: r => {
        this.riders.set(r.data.content);
        this.totalElements.set(r.data.totalElements);
        this.totalPages.set(r.data.totalPages);
        this.loading.set(false);
      },
      error: () => { this.toast.error('Error', 'Failed to load riders.'); this.loading.set(false); },
    });
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

  kycBadgeClass(status: string): string {
    const map: Record<string, string> = {
      APPROVED:           'bg-green-100 text-green-700',
      UNDER_REVIEW:       'bg-blue-100 text-blue-700',
      PARTIALLY_REJECTED: 'bg-amber-100 text-amber-700',
      REJECTED:           'bg-red-100 text-red-700',
      EXPIRED:            'bg-orange-100 text-orange-700',
      NOT_STARTED:        'bg-gray-100 text-gray-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  statusBadgeClass(status: string): string {
    return status === 'ACTIVE'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';
  }
}
