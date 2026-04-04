import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PayslipService } from '../services/payslip.service';
import { Payslip, PayslipMiscItem } from '../models/payslip.model';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-payslip-editor',
  imports: [FormsModule],
  templateUrl: './payslip-editor.html',
})
export class PayslipEditor implements OnInit {
  payslip = input.required<Payslip>();
  closed = output<boolean>();

  workingDays = signal(22);
  normalOvertimeHours = signal(0);
  holidayOvertimeHours = signal(0);
  newMiscDescription = '';
  newMiscAmount: number | null = null;
  saving = signal(false);
  addingMisc = signal(false);
  localMiscItems = signal<PayslipMiscItem[]>([]);
  changed = signal(false);

  // OT hourly base always uses the full contracted basic salary, not the prorated value
  hourlyBase = computed(() => this.payslip().basicSalary / 160);

  // Basic salary prorated when working days < 22: (workingDays/22) × basicSalary
  proratedBasicSalary = computed(() => {
    const wd = this.workingDays();
    const basic = this.payslip().basicSalary;
    return wd < 22 ? (wd / 22) * basic : basic;
  });

  liveOvertimeAmount = computed(() => {
    const hb = this.hourlyBase();
    const p = this.payslip();
    return (this.normalOvertimeHours() * hb * p.normalOvertimeRate)
         + (this.holidayOvertimeHours() * hb * p.holidayOvertimeRate);
  });

  liveFixedSum = computed(() => {
    const p = this.payslip();
    // Use prorated basic salary; allowances are always paid in full
    return this.proratedBasicSalary() + p.housingAllowance + p.transportAllowance
         + p.cellphoneAllowance + p.medicalAllowance + p.otherAllowances;
  });

  liveMiscSum = computed(() => {
    let total = 0;
    for (const item of this.localMiscItems()) {
      if (item.amount < 0) {
        total -= Math.abs(item.amount); // negative = penalty/deduction
      } else {
        total += item.amount;           // positive = reimbursement/bonus
      }
    }
    return total;
  });

  liveNetSalary = computed(() => {
    let net = this.liveFixedSum() + this.liveOvertimeAmount();
    for (const item of this.localMiscItems()) {
      if (item.amount < 0) {
        net -= Math.abs(item.amount);
      } else {
        net += item.amount;
      }
    }
    return net;
  });

  private toast = inject(ToastService);

  constructor(private payslipService: PayslipService) {}

  ngOnInit() {
    const p = this.payslip();
    this.workingDays.set(p.workingDays ?? 22);
    this.normalOvertimeHours.set(p.normalOvertimeHours);
    this.holidayOvertimeHours.set(p.holidayOvertimeHours);
    this.localMiscItems.set([...p.miscItems]);
  }

  saveHours() {
    this.saving.set(true);
    this.payslipService
      .patch(this.payslip().id, this.workingDays(), this.normalOvertimeHours(), this.holidayOvertimeHours())
      .subscribe({
        next: () => {
          this.changed.set(true);
          this.saving.set(false);
          this.toast.success('Hours saved.');
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Failed to save hours.', 'Please try again.');
        },
      });
  }

  addMisc() {
    if (!this.newMiscDescription.trim() || this.newMiscAmount === null) return;
    this.addingMisc.set(true);
    this.payslipService
      .addMiscItem(this.payslip().id, this.newMiscDescription, this.newMiscAmount)
      .subscribe({
        next: res => {
          const updated = res.data;
          this.localMiscItems.set([...updated.miscItems]);
          this.newMiscDescription = '';
          this.newMiscAmount = null;
          this.changed.set(true);
          this.addingMisc.set(false);
          this.toast.success('Adjustment added.');
        },
        error: () => {
          this.addingMisc.set(false);
          this.toast.error('Failed to add adjustment.', 'Please try again.');
        },
      });
  }

  deleteMisc(miscId: string) {
    this.payslipService.deleteMiscItem(this.payslip().id, miscId).subscribe({
      next: res => {
        this.localMiscItems.set([...res.data.miscItems]);
        this.changed.set(true);
        this.toast.success('Adjustment removed.');
      },
      error: () => {
        this.toast.error('Failed to remove adjustment.', 'Please try again.');
      },
    });
  }

  printPayslip() {
    const p = this.payslip();
    const items = this.localMiscItems();
    const wd = this.workingDays();
    const prorated = this.proratedBasicSalary();
    const fixedSum = this.liveFixedSum();
    const overtimeAmt = this.liveOvertimeAmount();
    const miscSum = this.liveMiscSum();
    const netSalary = this.liveNetSalary();
    const period = `${this.monthName(p.month)} ${p.year}`;
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const miscRows = items.length
      ? items.map(item => `
          <tr>
            <td style="padding:6px 12px;color:#374151;">${item.description}</td>
            <td style="padding:6px 12px;text-align:right;font-weight:600;color:${item.amount < 0 ? '#dc2626' : '#16a34a'};">
              ${item.amount < 0 ? '− ' : '+ '}${fmt(Math.abs(item.amount))}
            </td>
          </tr>`).join('')
      : `<tr><td colspan="2" style="padding:6px 12px;color:#9ca3af;font-style:italic;">No adjustments</td></tr>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payslip — ${p.userName} — ${period}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111827; background: #fff; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 800; color: #4f46e5; }
    .brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .badge { background: #dc2626; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.05em; }
    .employee { margin-bottom: 20px; }
    .employee-name { font-size: 20px; font-weight: 700; color: #111827; }
    .employee-period { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .section-title { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    tr:nth-child(even) td { background: #f9fafb; }
    td { padding: 6px 12px; }
    td:last-child { text-align: right; font-weight: 600; color: #1f2937; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .total-row td { padding: 8px 12px; font-weight: 700; font-size: 14px; border-top: 2px solid #e5e7eb; }
    .net-box { background: #f0f4ff; border: 2px solid #4f46e5; border-radius: 8px; padding: 16px 20px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
    .net-label { font-size: 13px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; }
    .net-amount { font-size: 26px; font-weight: 800; color: #111827; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; color: #9ca3af; font-size: 11px; }
    @media print {
      body { padding: 20px; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">GigMaster</div>
      <div class="brand-sub">Payroll Management</div>
    </div>
    <span class="badge">LOCKED</span>
  </div>

  <div class="employee">
    <div class="employee-name">${p.userName}</div>
    <div class="employee-period">${period}</div>
  </div>

  <div class="section-title">Salary Components</div>
  <table>
    <tr>
      <td style="color:#6b7280;">Basic Salary${wd < 22 ? ` <span style="color:#d97706;font-size:11px;">(${wd}/22 days)</span>` : ''}</td>
      <td>${fmt(prorated)}${wd < 22 ? `<div style="font-size:11px;color:#9ca3af;text-align:right;">of ${fmt(p.basicSalary)}</div>` : ''}</td>
    </tr>
    <tr><td style="color:#6b7280;">Housing Allowance</td><td>${fmt(p.housingAllowance)}</td></tr>
    <tr><td style="color:#6b7280;">Transport Allowance</td><td>${fmt(p.transportAllowance)}</td></tr>
    <tr><td style="color:#6b7280;">Cellphone Allowance</td><td>${fmt(p.cellphoneAllowance)}</td></tr>
    <tr><td style="color:#6b7280;">Medical Allowance</td><td>${fmt(p.medicalAllowance)}</td></tr>
    <tr><td style="color:#6b7280;">Other Allowances</td><td>${fmt(p.otherAllowances)}</td></tr>
    <tr class="total-row"><td>Fixed Total</td><td>${fmt(fixedSum)}</td></tr>
  </table>

  <div class="section-title">Overtime</div>
  <table>
    <tr><td style="color:#6b7280;">Normal OT (${p.normalOvertimeHours} hrs × ${p.normalOvertimeRate}x)</td><td>${fmt(p.normalOvertimeHours * (p.basicSalary / 160) * p.normalOvertimeRate)}</td></tr>
    <tr><td style="color:#6b7280;">Holiday OT (${p.holidayOvertimeHours} hrs × ${p.holidayOvertimeRate}x)</td><td>${fmt(p.holidayOvertimeHours * (p.basicSalary / 160) * p.holidayOvertimeRate)}</td></tr>
    <tr class="total-row"><td>Overtime Total</td><td>${fmt(overtimeAmt)}</td></tr>
  </table>

  <div class="section-title">Adjustments</div>
  <table>${miscRows}
    ${items.length ? `<tr class="total-row"><td>Adjustments Total</td><td style="color:${miscSum < 0 ? '#dc2626' : '#16a34a'}">${miscSum < 0 ? '− ' : '+ '}${fmt(Math.abs(miscSum))}</td></tr>` : ''}
  </table>

  <div class="net-box">
    <span class="net-label">Net Salary</span>
    <span class="net-amount">${fmt(netSalary)}</span>
  </div>

  <div class="footer">
    <span>Generated by GigMaster &mdash; ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
    <span>Status: LOCKED &mdash; This is a system-generated payslip</span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=800,height=900');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  close() {
    this.closed.emit(this.changed());
  }

  monthName(m: number): string {
    return new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' });
  }

  formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  /** Shows explicit +/- prefix for misc items: +$200.00 or -$100.00 */
  formatAmount(n: number): string {
    const abs = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
    return n < 0 ? `− ${abs}` : `+ ${abs}`;
  }
}
