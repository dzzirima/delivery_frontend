import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PayslipService } from '../services/payslip.service';
import { BulkInitResult, Payslip, PayrollSummary } from '../models/payslip.model';
import { PayslipEditor } from '../payslip-editor/payslip-editor';

@Component({
  selector: 'app-payroll',
  imports: [FormsModule, PayslipEditor],
  templateUrl: './payroll.html',
})
export class Payroll implements OnInit {
  readonly months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  selectedMonth = signal(new Date().getMonth() + 1);
  selectedYear = signal(new Date().getFullYear());
  payslips = signal<Payslip[]>([]);
  summary = signal<PayrollSummary | null>(null);
  bulkResult = signal<BulkInitResult | null>(null);
  loading = signal(false);
  initLoading = signal(false);
  editingPayslip = signal<Payslip | null>(null);

  hasBatch = computed(() => this.payslips().length > 0);
  canReset = computed(() =>
    this.hasBatch() && this.payslips().every(p => p.status === 'DRAFT')
  );

  constructor(private payslipService: PayslipService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const month = this.selectedMonth();
    const year = this.selectedYear();

    this.payslipService.getAll(month, year).subscribe({
      next: res => {
        this.payslips.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });

    this.payslipService.getSummary(month, year).subscribe({
      next: res => {
        this.summary.set(res.data ?? null);
      },
      error: () => {
        this.summary.set(null);
      },
    });
  }

  onPeriodChange() {
    this.bulkResult.set(null);
    this.load();
  }

  initBatch() {
    if (this.hasBatch()) return;
    this.initLoading.set(true);
    this.payslipService.bulkInit(this.selectedMonth(), this.selectedYear()).subscribe({
      next: res => {
        this.bulkResult.set(res.data);
        this.initLoading.set(false);
        this.load();
      },
      error: () => {
        this.initLoading.set(false);
      },
    });
  }

  openEditor(p: Payslip) {
    this.editingPayslip.set(p);
  }

  closeEditor(reload: boolean) {
    this.editingPayslip.set(null);
    if (reload) {
      this.load();
    }
  }

  onRegenerate(id: string) {
    if (!confirm('Regenerate this payslip from the current contract? Overtime hours and misc items will be preserved.')) return;
    this.payslipService.regenerate(id).subscribe({
      next: () => this.load(),
    });
  }

  onFinalize(id: string) {
    if (!confirm('Lock this payslip? This cannot be undone.')) return;
    this.payslipService.finalize(id).subscribe({
      next: () => this.load(),
    });
  }

  onGenerateIndividual(userId: string) {
    this.payslipService
      .generateIndividual(userId, this.selectedMonth(), this.selectedYear())
      .subscribe({
        next: () => {
          this.bulkResult.set(null);
          this.load();
        },
      });
  }

  onResetBatch() {
    if (!confirm('This will delete all drafts for this period. Continue?')) return;
    this.payslipService.resetBatch(this.selectedMonth(), this.selectedYear()).subscribe({
      next: () => {
        this.bulkResult.set(null);
        this.load();
      },
    });
  }

  formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  monthName(m: number): string {
    return this.months.find(mo => mo.value === m)?.label ?? '';
  }

  statusClass(status: string): string {
    if (status === 'CLOSED') return 'bg-green-100 text-green-700';
    if (status === 'LOCKED') return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
  }
}
