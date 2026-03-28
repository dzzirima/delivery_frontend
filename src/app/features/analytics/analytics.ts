import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from './services/analytics.service';
import { ProductivityReport, OrgInfo } from './models/analytics.model';

@Component({
  selector: 'app-analytics',
  imports: [FormsModule],
  templateUrl: './analytics.html',
})
export class AnalyticsPage implements OnInit {
  private analyticsService = inject(AnalyticsService);

  // ── State ────────────────────────────────────────────────────────────────
  report        = signal<ProductivityReport[]>([]);
  org           = signal<OrgInfo | null>(null);
  loading       = signal(false);
  orgLoading    = signal(false);
  error         = signal<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  startDate     = signal<string>(this.firstOfMonth());
  endDate       = signal<string>(this.today());
  agentFilter   = signal<string>('');

  // ── Target editing ───────────────────────────────────────────────────────
  editingTarget = signal(false);
  targetInput   = signal(40);
  savingTarget  = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────────
  filteredReport = computed(() => {
    const q = this.agentFilter().toLowerCase().trim();
    if (!q) return this.report();
    return this.report().filter(r => r.agentName?.toLowerCase().includes(q));
  });

  summaryTotal = computed(() =>
    this.filteredReport().reduce((s, r) => s + r.totalApplications, 0)
  );

  summaryTarget = computed(() => {
    const rows = this.filteredReport();
    return rows.length > 0 ? rows[0].periodTarget * rows.length : 0;
  });

  summaryVariance = computed(() => this.summaryTotal() - this.summaryTarget());

  summarySuccess = computed(() => {
    const t = this.summaryTarget();
    if (t === 0) return 0;
    return Math.round((this.summaryTotal() / t) * 1000) / 10;
  });

  ngOnInit() {
    this.loadOrg();
    this.loadReport();
  }

  loadOrg() {
    this.orgLoading.set(true);
    this.analyticsService.getMyOrg().subscribe({
      next: res => {
        this.org.set(res.data);
        this.targetInput.set(res.data.dailyTarget ?? 40);
        this.orgLoading.set(false);
      },
      error: () => this.orgLoading.set(false),
    });
  }

  loadReport() {
    this.loading.set(true);
    this.error.set(null);
    this.analyticsService.getProductivity({
      startDate: this.startDate(),
      endDate:   this.endDate(),
    }).subscribe({
      next: res => {
        this.report.set(Array.isArray(res.data) ? res.data : []);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Failed to load report');
        this.loading.set(false);
      },
    });
  }

  applyFilters() {
    this.loadReport();
  }

  openEditTarget() {
    this.targetInput.set(this.org()?.dailyTarget ?? 40);
    this.editingTarget.set(true);
  }

  saveTarget() {
    const val = this.targetInput();
    if (!val || val < 1) return;
    this.savingTarget.set(true);
    this.analyticsService.updateDailyTarget(val).subscribe({
      next: res => {
        this.org.set(res.data);
        this.editingTarget.set(false);
        this.savingTarget.set(false);
        this.loadReport();
      },
      error: () => this.savingTarget.set(false),
    });
  }

  rowClass(row: ProductivityReport): string {
    if (row.variance >= 0)  return 'bg-emerald-50';
    if (row.variance >= -10) return 'bg-amber-50';
    return 'bg-red-50';
  }

  varianceBadge(row: ProductivityReport): string {
    if (row.variance >= 0)   return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800';
    if (row.variance >= -10) return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800';
    return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800';
  }

  successBadge(row: ProductivityReport): string {
    if (row.successPercentage >= 100) return 'text-emerald-700 font-semibold';
    if (row.successPercentage >= 70)  return 'text-amber-700 font-semibold';
    return 'text-red-700 font-semibold';
  }

  private firstOfMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
