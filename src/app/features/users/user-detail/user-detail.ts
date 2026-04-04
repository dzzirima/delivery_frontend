import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { User } from '../models/user.model';
import { ContractService } from '../../contracts/services/contract.service';
import { Contract, ContractPayload, ContractStatus } from '../../contracts/models/contract.model';
import { PayslipService } from '../../payslips/services/payslip.service';
import { Payslip } from '../../payslips/models/payslip.model';
import { ToastService } from '../../../core/toast.service';

interface ContractForm {
  jobTitle: string;
  basicSalary: number | null;
  housingAllowance: number;
  transportAllowance: number;
  cellphoneAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  normalOvertimeRate: number;
  holidayOvertimeRate: number;
  status: ContractStatus;
}

@Component({
  selector: 'app-user-detail',
  imports: [FormsModule],
  templateUrl: './user-detail.html',
})
export class UserDetail implements OnInit {
  user = signal<User | null>(null);
  contract = signal<Contract | null>(null);
  payslips = signal<Payslip[]>([]);
  loading = signal(true);

  showContractForm = signal(false);
  savingContract = signal(false);
  contractError = signal('');

  contractForm: ContractForm = this.emptyForm();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private contractService: ContractService,
    private payslipService: PayslipService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('id')!;
    this.load(userId);
  }

  private load(userId: string) {
    this.loading.set(true);
    forkJoin([
      this.userService.getById(userId),
      this.contractService.getByUserId(userId).pipe(catchError(() => of({ data: null }))),
      this.payslipService.getByUserId(userId).pipe(catchError(() => of({ data: [] }))),
    ]).subscribe({
      next: ([userRes, contractRes, payslipsRes]) => {
        this.user.set(userRes.data);
        this.contract.set(contractRes.data ?? null);
        this.payslips.set(payslipsRes.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load user details.');
        this.loading.set(false);
      },
    });
  }

  openCreateContract() {
    this.contractForm = this.emptyForm();
    this.contractError.set('');
    this.showContractForm.set(true);
  }

  openEditContract() {
    const c = this.contract();
    if (!c) return;
    this.contractForm = {
      jobTitle: c.jobTitle ?? '',
      basicSalary: c.basicSalary,
      housingAllowance: c.housingAllowance,
      transportAllowance: c.transportAllowance,
      cellphoneAllowance: c.cellphoneAllowance,
      medicalAllowance: c.medicalAllowance,
      otherAllowances: c.otherAllowances,
      normalOvertimeRate: c.normalOvertimeRate,
      holidayOvertimeRate: c.holidayOvertimeRate,
      status: c.status,
    };
    this.contractError.set('');
    this.showContractForm.set(true);
  }

  cancelContractForm() {
    this.showContractForm.set(false);
    this.contractError.set('');
  }

  saveContract() {
    const f = this.contractForm;
    if (!f.basicSalary) { this.contractError.set('Basic salary is required.'); return; }

    const payload: ContractPayload = {
      userId: this.user()!.id,
      jobTitle: f.jobTitle || undefined,
      status: f.status,
      basicSalary: f.basicSalary,
      housingAllowance: f.housingAllowance,
      transportAllowance: f.transportAllowance,
      cellphoneAllowance: f.cellphoneAllowance,
      medicalAllowance: f.medicalAllowance,
      otherAllowances: f.otherAllowances,
      normalOvertimeRate: f.normalOvertimeRate,
      holidayOvertimeRate: f.holidayOvertimeRate,
    };

    this.savingContract.set(true);
    this.contractError.set('');

    const existing = this.contract();
    const req$ = existing
      ? this.contractService.update(existing.id, payload)
      : this.contractService.create(payload);

    req$.subscribe({
      next: res => {
        this.contract.set(res.data);
        this.showContractForm.set(false);
        this.savingContract.set(false);
        this.toast.success(existing ? 'Contract updated.' : 'Contract created.');
      },
      error: err => {
        this.contractError.set(err?.error?.message ?? 'Failed to save contract.');
        this.savingContract.set(false);
      },
    });
  }

  toggleContractStatus() {
    const c = this.contract();
    if (!c) return;
    const next: ContractStatus = c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.contractService.updateStatus(c.id, next).subscribe({
      next: res => {
        this.contract.set(res.data);
        this.toast.success(`Contract ${next === 'ACTIVE' ? 'activated' : 'suspended'}.`);
      },
      error: () => this.toast.error('Failed to update contract status.'),
    });
  }

  back() {
    this.router.navigate(['/app/users']);
  }

  monthName(m: number): string {
    return new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' });
  }

  formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  private emptyForm(): ContractForm {
    return {
      jobTitle: '',
      basicSalary: null,
      housingAllowance: 0,
      transportAllowance: 0,
      cellphoneAllowance: 0,
      medicalAllowance: 0,
      otherAllowances: 0,
      normalOvertimeRate: 1.5,
      holidayOvertimeRate: 2.0,
      status: 'ACTIVE',
    };
  }
}
