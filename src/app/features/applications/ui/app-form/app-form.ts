import { Component, Input, OnInit, Output, EventEmitter, signal, computed, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Application,
  ApplicationPayload,
  APPLICATION_STATUSES,
  APPLICATION_PLATFORMS,
  APPLICATION_TYPES,
} from '../../models/application.model';
import { PortfolioService } from '../../../portfolio/services/portfolio.service';
import { Portfolio } from '../../../portfolio/models/portfolio.model';

@Component({
  selector: 'app-application-form',
  imports: [FormsModule],
  templateUrl: './app-form.html',
})
export class AppForm implements OnInit {
  @Input() application: Application | null = null;
  @Output() saved = new EventEmitter<ApplicationPayload>();
  @Output() cancelled = new EventEmitter<void>();

  readonly statuses = APPLICATION_STATUSES;
  readonly platforms = APPLICATION_PLATFORMS;
  readonly applicationTypes = APPLICATION_TYPES;

  form: ApplicationPayload = {
    company: '',
    position: '',
    recruitingAgent: '',
    platform: undefined,
    applicationType: undefined,
    status: 'APPLIED',
    appliedDate: new Date().toISOString().split('T')[0],
    notes: '',
    portfolioId: undefined,
  };

  // Portfolio dropdown state
  portfolios = signal<Portfolio[]>([]);
  portfoliosLoading = signal(false);
  portfolioSearch = signal('');
  dropdownOpen = signal(false);
  portfolioId = signal<string | undefined>(undefined);

  filteredPortfolios = computed(() => {
    const q = this.portfolioSearch().toLowerCase().trim();
    if (!q) return this.portfolios();
    return this.portfolios().filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
  });

  selectedPortfolio = computed(() =>
    this.portfolios().find(p => p.id === this.portfolioId()) ?? null
  );

  constructor(private portfolioService: PortfolioService) {}

  ngOnInit() {
    this.loadPortfolios();
    if (this.application) {
      this.form = {
        company: this.application.company,
        position: this.application.position,
        recruitingAgent: this.application.recruitingAgent ?? '',
        platform: this.application.platform,
        applicationType: this.application.applicationType,
        status: this.application.status,
        appliedDate: this.application.appliedDate ?? new Date().toISOString().split('T')[0],
        notes: this.application.notes ?? '',
        portfolioId: undefined,
      };
      this.portfolioId.set(this.application.portfolioId);
    }
  }

  private loadPortfolios() {
    this.portfoliosLoading.set(true);
    this.portfolioService.getActive().subscribe({
      next: res => {
        this.portfolios.set(res.data?.content ?? []);
        this.portfoliosLoading.set(false);
      },
      error: () => this.portfoliosLoading.set(false),
    });
  }

  openDropdown() {
    this.portfolioSearch.set('');
    this.dropdownOpen.set(true);
  }

  selectPortfolio(p: Portfolio) {
    this.portfolioId.set(p.id);
    this.dropdownOpen.set(false);
    this.portfolioSearch.set('');
  }

  clearPortfolio() {
    this.portfolioId.set(undefined);
    this.dropdownOpen.set(false);
    this.portfolioSearch.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.portfolio-dropdown')) {
      this.dropdownOpen.set(false);
    }
  }

  submit() {
    if (!this.form.company.trim() || !this.form.position.trim()) return;
    this.saved.emit({ ...this.form, portfolioId: this.portfolioId() });
  }

  cancel() {
    this.cancelled.emit();
  }

  get title(): string {
    return this.application ? 'Edit Application' : 'New Application';
  }
}
