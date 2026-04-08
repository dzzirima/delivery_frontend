import { Component, OnInit, signal } from '@angular/core';
import { PayslipService } from '../services/payslip.service';
import { Payslip } from '../models/payslip.model';
import { PayslipEditor } from '../payslip-editor/payslip-editor';

@Component({
  selector: 'app-my-payslips',
  imports: [PayslipEditor],
  templateUrl: './my-payslips.html',
})
export class MyPayslips implements OnInit {
  payslips  = signal<Payslip[]>([]);
  loading   = signal(false);
  viewing   = signal<Payslip | null>(null);

  constructor(private payslipService: PayslipService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.payslipService.getMyPaidPayslips().subscribe({
      next: res => { this.payslips.set(res.data ?? []); this.loading.set(false); },
      error: ()  => { this.loading.set(false); },
    });
  }

  open(p: Payslip) { this.viewing.set(p); }
  closeViewer()    { this.viewing.set(null); }

  formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  monthName(m: number): string {
    return new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' });
  }
}
