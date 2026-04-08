import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PayrollBillService } from '../services/payroll-bill.service';
import { CreateBillResult, PayrollBill } from '../models/payroll-bill.model';

@Component({
  selector: 'app-payroll-bill-list',
  imports: [FormsModule],
  templateUrl: './payroll-bill-list.html',
})
export class PayrollBillList implements OnInit {
  readonly months = [
    { value: 1,  label: 'January' },  { value: 2,  label: 'February' },
    { value: 3,  label: 'March' },    { value: 4,  label: 'April' },
    { value: 5,  label: 'May' },      { value: 6,  label: 'June' },
    { value: 7,  label: 'July' },     { value: 8,  label: 'August' },
    { value: 9,  label: 'September' },{ value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  bills       = signal<PayrollBill[]>([]);
  loading     = signal(false);
  showCreate  = signal(false);
  creating    = signal(false);
  createError = signal('');
  lastResult  = signal<CreateBillResult | null>(null);

  newMonth = new Date().getMonth() + 1;
  newYear  = new Date().getFullYear();

  constructor(
    private billService: PayrollBillService,
    private router: Router,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.billService.listBills().subscribe({
      next: res => { this.bills.set(res.data ?? []); this.loading.set(false); },
      error: ()  => { this.loading.set(false); },
    });
  }

  toggleCreate() {
    this.showCreate.update(v => !v);
    this.createError.set('');
    this.lastResult.set(null);
  }

  onCreateBill() {
    this.creating.set(true);
    this.createError.set('');
    this.billService.createBill(this.newMonth, this.newYear).subscribe({
      next: res => {
        this.creating.set(false);
        this.lastResult.set(res.data);
        this.showCreate.set(false);
        this.load();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(err?.error?.message ?? 'Failed to create bill.');
      },
    });
  }

  viewDetail(id: string) { this.router.navigate(['/app/payroll-bills', id]); }

  formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  statusClass(status: string): string {
    return status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
  }
}
