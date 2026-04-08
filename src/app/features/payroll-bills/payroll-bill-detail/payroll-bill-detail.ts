import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PayrollBillService } from '../services/payroll-bill.service';
import { PayrollBillDetail } from '../models/payroll-bill.model';
import { Payslip } from '../../payslips/models/payslip.model';
import { PayslipEditor } from '../../payslips/payslip-editor/payslip-editor';
import { PayslipService } from '../../payslips/services/payslip.service';

@Component({
  selector: 'app-payroll-bill-detail',
  imports: [PayslipEditor],
  templateUrl: './payroll-bill-detail.html',
})
export class PayrollBillDetailPage implements OnInit {
  detail          = signal<PayrollBillDetail | null>(null);
  loading         = signal(false);
  closing        = signal(false);
  regenerating   = signal(false);
  deletingDrafts = signal(false);
  deletingBill   = signal(false);
  error          = signal('');
  viewingPayslip  = signal<Payslip | null>(null);

  private billId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private billService: PayrollBillService,
    private payslipService: PayslipService,
  ) {}

  ngOnInit() {
    this.billId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.billService.getBillDetail(this.billId).subscribe({
      next: res => { this.detail.set(res.data); this.loading.set(false); },
      error: ()  => { this.loading.set(false); },
    });
  }

  goBack() { this.router.navigate(['/app/payroll-bills']); }

  onCloseBill() {
    if (!confirm('Close this bill? All DRAFT payslips will be marked as Paid.')) return;
    this.closing.set(true);
    this.billService.closeBill(this.billId).subscribe({
      next: () => { this.closing.set(false); this.load(); },
      error: (err) => { this.closing.set(false); this.error.set(err?.error?.message ?? 'Failed to close bill.'); },
    });
  }

  onRegenerateBatch() {
    if (!confirm('Regenerate all DRAFT payslips from the latest contracts? Manual overtime hours and adjustments will be preserved.')) return;
    this.regenerating.set(true);
    this.billService.regenerateBatch(this.billId).subscribe({
      next: () => { this.regenerating.set(false); this.load(); },
      error: (err) => { this.regenerating.set(false); this.error.set(err?.error?.message ?? 'Failed to regenerate.'); },
    });
  }

  onDeleteDrafts() {
    if (!confirm('Delete all DRAFT payslips from this bill? This cannot be undone.')) return;
    this.deletingDrafts.set(true);
    this.billService.deleteDraftPayslips(this.billId).subscribe({
      next: () => { this.deletingDrafts.set(false); this.load(); },
      error: (err) => { this.deletingDrafts.set(false); this.error.set(err?.error?.message ?? 'Failed to delete drafts.'); },
    });
  }

  openPayslip(p: Payslip) { this.viewingPayslip.set(p); }
  closePayslipEditor(reload: boolean) {
    this.viewingPayslip.set(null);
    if (reload) this.load();
  }

  onDeleteBill() {
    if (!confirm('Delete this bill and all its payslips? This cannot be undone.')) return;
    this.deletingBill.set(true);
    this.billService.deleteBill(this.billId).subscribe({
      next: () => { this.deletingBill.set(false); this.router.navigate(['/app/payroll-bills']); },
      error: (err) => { this.deletingBill.set(false); this.error.set(err?.error?.message ?? 'Failed to delete bill.'); },
    });
  }

  onRegenerate(id: string) {
    if (!confirm('Regenerate this payslip from the current contract? Overtime hours and misc items will be preserved.')) return;
    this.payslipService.regenerate(id).subscribe({ next: () => this.load() });
  }

  onFinalize(id: string) {
    if (!confirm('Lock this payslip? This cannot be undone.')) return;
    this.payslipService.finalize(id).subscribe({ next: () => this.load() });
  }

  get bill()           { return this.detail()?.bill ?? null; }
  get payslips(): Payslip[] { return this.detail()?.payslips ?? []; }
  get hasDrafts(): boolean  { return this.payslips.some(p => p.status === 'DRAFT'); }

  isDraft(): boolean { return this.bill?.status === 'DRAFT'; }

  varianceSign(): 'up' | 'down' | 'flat' {
    const v = this.detail()?.netVariance;
    if (v == null || v === 0) return 'flat';
    return v > 0 ? 'up' : 'down';
  }

  formatCurrency(n: number | null | undefined): string {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  formatPct(n: number | null | undefined): string {
    if (n == null) return '—';
    return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
  }

  slipStatusClass(status: string): string {
    if (status === 'CLOSED') return 'bg-green-100 text-green-700';
    if (status === 'LOCKED') return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
  }

  billStatusClass(status: string): string {
    return status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
  }
}
