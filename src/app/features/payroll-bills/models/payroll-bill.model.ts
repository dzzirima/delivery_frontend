import { Payslip } from '../../payslips/models/payslip.model';

export type PayrollBillStatus = 'DRAFT' | 'CLOSED';

export interface PayrollBill {
  id: string;
  month: number;
  year: number;
  billingPeriod: string;
  status: PayrollBillStatus;
  totalAmount: number;
  payslipCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillResult {
  bill: PayrollBill;
  generated: number;
  alreadyLinked: number;
  skipped: { userId: string; userName: string; reason: string }[];
}

export interface PayrollBillDetail {
  bill: PayrollBill;
  payslips: Payslip[];
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  totalReimbursements: number;
  previousTotalNet: number | null;
  netVariance: number | null;
  netVariancePercent: number | null;
}
