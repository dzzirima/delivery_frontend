import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AdminOrgsService, PlatformOrg } from './organisations.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-admin-organisations',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './organisations.html',
})
export class AdminOrganisations implements OnInit {

  orgs          = signal<PlatformOrg[]>([]);
  loading       = signal(false);
  totalElements = signal(0);
  totalPages    = signal(0);
  page          = signal(0);
  readonly size = 20;

  searchDraft = '';
  searchQuery = signal('');

  constructor(
    private orgsService: AdminOrgsService,
    private toast:       ToastService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.orgsService.list(this.page(), this.size, this.searchQuery() || undefined).subscribe({
      next: r => {
        this.orgs.set(r.data.content);
        this.totalElements.set(r.data.totalElements);
        this.totalPages.set(r.data.totalPages);
        this.loading.set(false);
      },
      error: () => { this.toast.error('Error', 'Failed to load organisations.'); this.loading.set(false); },
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

  statusBadgeClass(status: string): string {
    return status === 'ACTIVE'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';
  }
}
