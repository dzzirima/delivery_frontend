import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PortfolioService } from './services/portfolio.service';
import { ToastService } from '../../core/toast.service';
import { Portfolio, PortfolioPayload, PORTFOLIO_STATUSES, PortfolioStatus } from './models/portfolio.model';

@Component({
  selector: 'app-portfolio',
  imports: [FormsModule],
  templateUrl: './portfolio.html',
})
export class PortfolioPage implements OnInit {
  readonly statuses = PORTFOLIO_STATUSES;

  portfolios = signal<Portfolio[]>([]);
  loading = signal(false);
  error = signal('');

  showForm = signal(false);
  editing = signal<Portfolio | null>(null);
  saving = signal(false);

  form: PortfolioPayload = this.emptyForm();

  private router = inject(Router);

  constructor(private portfolioService: PortfolioService, private toast: ToastService) {}

  viewPortfolio(id: string) {
    this.router.navigate(['/app/portfolio', id]);
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.portfolioService.getAll().subscribe({
      next: res => {
        this.portfolios.set(Array.isArray(res.data.content) ? res.data.content : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load portfolios.');
        this.loading.set(false);
      },
    });
  }

  openNew() {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.showForm.set(true);
  }

  openEdit(p: Portfolio) {
    this.editing.set(p);
    this.form = {
      firstName: p.firstName,
      lastName: p.lastName,
      state: p.state ?? '',
      phoneNumber: p.phoneNumber ?? '',
      address: p.address ?? '',
      agreedPercent: p.agreedPercent,
      notes: p.notes ?? '',
      status: p.status,
    };
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editing.set(null);
  }

  save() {
    if (!this.form.firstName.trim() || !this.form.lastName.trim()) return;
    this.saving.set(true);
    const item = this.editing();
    const req$ = item
      ? this.portfolioService.update(item.id, this.form)
      : this.portfolioService.create(this.form);

    req$.subscribe({
      next: () => {
        // Toast messages say "Profile" — internal code stays as portfolio
        this.toast.success(item ? 'Profile updated!' : 'Profile created!');
        this.closeForm();
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.toast.error('Failed to save profile.');
        this.saving.set(false);
      },
    });
  }

  delete(id: string) {
    if (!confirm('Delete this profile entry?')) return;
    this.portfolioService.delete(id).subscribe({
      next: () => {
        this.toast.success('Profile deleted.');
        this.portfolios.update(list => list.filter(p => p.id !== id));
      },
      error: () => this.toast.error('Failed to delete profile.'),
    });
  }

  statusClass(status: PortfolioStatus): string {
    const map: Record<PortfolioStatus, string> = {
      ACTIVE:    'bg-green-100 text-green-700',
      SUSPENDED: 'bg-amber-100 text-amber-700',
      ARCHIVED:  'bg-gray-100 text-gray-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  private emptyForm(): PortfolioPayload {
    return { firstName: '', lastName: '', state: '', phoneNumber: '', address: '', agreedPercent: undefined, notes: '', status: 'ACTIVE' };
  }
}
