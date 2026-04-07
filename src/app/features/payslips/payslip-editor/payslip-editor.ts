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

    const orgName = p.organisationName ?? 'Organisation';
    const deptLabel = p.department
      ? p.department.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
      : '';
    const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const generatedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payslip — ${p.userName} — ${period}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111827; background: #fff; padding: 40px 48px; max-width: 800px; margin: 0 auto; }

    /* ── Header ── */
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; margin-bottom: 24px; border-bottom: 3px solid #1e3a5f; }
    .org-name { font-size: 24px; font-weight: 800; color: #1e3a5f; letter-spacing: -0.5px; }
    .org-sub { font-size: 11px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.06em; }
    .header-right { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 700; color: #1e3a5f; }
    .period-badge { display: inline-block; margin-top: 4px; background: #1e3a5f; color: #fff; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 4px; letter-spacing: 0.05em; }

    /* ── Employee info ── */
    .employee-card { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
    .emp-left { flex: 1; }
    .emp-name { font-size: 18px; font-weight: 700; color: #111827; }
    .emp-role { font-size: 12px; color: #4f46e5; font-weight: 600; margin-top: 3px; }
    .emp-detail { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .emp-right { text-align: right; }
    .emp-right .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
    .emp-right .value { font-size: 12px; color: #374151; font-weight: 600; margin-top: 1px; }

    /* ── Section ── */
    .section-title { font-size: 10px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.1em; margin: 20px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 5px 10px; font-size: 12.5px; }
    tr:nth-child(even) td { background: #f9fafb; }
    td:last-child { text-align: right; font-weight: 600; color: #1f2937; }
    .total-row td { padding: 8px 10px; font-weight: 700; font-size: 13px; background: #f1f5f9 !important; border-top: 1.5px solid #cbd5e1; color: #1e3a5f; }

    /* ── Net box ── */
    .net-box { display: flex; justify-content: space-between; align-items: center; background: #1e3a5f; border-radius: 8px; padding: 18px 24px; margin-top: 24px; }
    .net-label { font-size: 12px; font-weight: 600; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.08em; }
    .net-period { font-size: 11px; color: #93c5fd; margin-top: 2px; }
    .net-amount { font-size: 28px; font-weight: 800; color: #fff; }

    /* ── Disclaimer ── */
    .disclaimer { margin-top: 28px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; display: flex; align-items: flex-start; gap: 8px; }
    .disclaimer-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
    .disclaimer-text { font-size: 11px; color: #92400e; line-height: 1.5; }
    .disclaimer-text strong { font-weight: 700; }

    /* ── Footer ── */
    .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; color: #9ca3af; font-size: 10.5px; }

    @media print {
      body { padding: 16px 24px; }
      @page { margin: 1cm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="org-name">${orgName}</div>
      <div class="org-sub">Payroll Department</div>
    </div>
    <div class="header-right">
      <div class="doc-title">PAYSLIP</div>
      <span class="period-badge">${period}</span>
    </div>
  </div>

  <!-- Employee card -->
  <div class="employee-card">
    <div class="emp-left">
      <div class="emp-name">${p.userName}</div>
      ${p.jobTitle ? `<div class="emp-role">${p.jobTitle}${deptLabel ? ' &nbsp;·&nbsp; ' + deptLabel : ''}</div>` : (deptLabel ? `<div class="emp-role">${deptLabel}</div>` : '')}
      ${p.userPhone ? `<div class="emp-detail">📞 ${p.userPhone}</div>` : ''}
      ${p.userAddress ? `<div class="emp-detail">📍 ${p.userAddress}</div>` : ''}
    </div>
    <div class="emp-right">
      <div class="label">Pay Period</div>
      <div class="value">${period}</div>
      <div class="label" style="margin-top:10px;">Working Days</div>
      <div class="value">${wd} / 22</div>
      <div class="label" style="margin-top:10px;">Pay Status</div>
      <div class="value" style="color:#16a34a;">LOCKED</div>
    </div>
  </div>

  <!-- Salary Components -->
  <div class="section-title">Earnings</div>
  <table>
    <tr>
      <td style="color:#6b7280;">Basic Salary${wd < 22 ? ` <span style="color:#d97706;font-size:11px;">(${wd}/22 days prorated)</span>` : ''}</td>
      <td>${fmt(prorated)}${wd < 22 ? `<div style="font-size:11px;color:#9ca3af;text-align:right;">contract: ${fmt(p.basicSalary)}</div>` : ''}</td>
    </tr>
    ${p.housingAllowance > 0 ? `<tr><td style="color:#6b7280;">Housing Allowance</td><td>${fmt(p.housingAllowance)}</td></tr>` : ''}
    ${p.transportAllowance > 0 ? `<tr><td style="color:#6b7280;">Transport Allowance</td><td>${fmt(p.transportAllowance)}</td></tr>` : ''}
    ${p.cellphoneAllowance > 0 ? `<tr><td style="color:#6b7280;">Cellphone Allowance</td><td>${fmt(p.cellphoneAllowance)}</td></tr>` : ''}
    ${p.medicalAllowance > 0 ? `<tr><td style="color:#6b7280;">Medical Allowance</td><td>${fmt(p.medicalAllowance)}</td></tr>` : ''}
    ${p.otherAllowances > 0 ? `<tr><td style="color:#6b7280;">Other Allowances</td><td>${fmt(p.otherAllowances)}</td></tr>` : ''}
    <tr class="total-row"><td>Total Earnings</td><td>${fmt(fixedSum)}</td></tr>
  </table>

  <!-- Overtime -->
  ${overtimeAmt > 0 ? `
  <div class="section-title">Overtime</div>
  <table>
    ${p.normalOvertimeHours > 0 ? `<tr><td style="color:#6b7280;">Normal OT &nbsp;(${p.normalOvertimeHours} hrs × ${p.normalOvertimeRate}×)</td><td>${fmt(p.normalOvertimeHours * (p.basicSalary / 160) * p.normalOvertimeRate)}</td></tr>` : ''}
    ${p.holidayOvertimeHours > 0 ? `<tr><td style="color:#6b7280;">Holiday OT &nbsp;(${p.holidayOvertimeHours} hrs × ${p.holidayOvertimeRate}×)</td><td>${fmt(p.holidayOvertimeHours * (p.basicSalary / 160) * p.holidayOvertimeRate)}</td></tr>` : ''}
    <tr class="total-row"><td>Total Overtime</td><td>${fmt(overtimeAmt)}</td></tr>
  </table>` : ''}

  <!-- Adjustments -->
  ${items.length ? `
  <div class="section-title">Adjustments</div>
  <table>
    ${miscRows}
    <tr class="total-row">
      <td>Net Adjustments</td>
      <td style="color:${miscSum < 0 ? '#dc2626' : '#16a34a'}">${miscSum < 0 ? '− ' : '+ '}${fmt(Math.abs(miscSum))}</td>
    </tr>
  </table>` : ''}

  <!-- Net Salary -->
  <div class="net-box">
    <div>
      <div class="net-label">Net Salary</div>
      <div class="net-period">${period}</div>
    </div>
    <div class="net-amount">${fmt(netSalary)}</div>
  </div>

  <!-- System-generated disclaimer -->
  <div class="disclaimer">
    <span class="disclaimer-icon">⚠</span>
    <div class="disclaimer-text">
      <strong>System-Generated Document.</strong> This payslip was automatically generated by the payroll management system on ${generatedOn} at ${generatedAt}.
      It does not require a physical signature and is valid as an official payroll record. Do not alter this document.
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>${orgName} &mdash; Payroll Management System</span>
    <span>Generated: ${generatedOn} ${generatedAt} &nbsp;|&nbsp; Ref: ${p.id.substring(0, 8).toUpperCase()}</span>
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
