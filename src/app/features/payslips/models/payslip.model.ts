export type PayslipStatus = 'DRAFT' | 'LOCKED';

export interface PayslipMiscItem {
  id: string;
  description: string;
  amount: number;
}

export interface Payslip {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  userAddress?: string;
  jobTitle?: string;
  department?: string;
  organisationName?: string;
  month: number;
  year: number;
  status: PayslipStatus;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  cellphoneAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  normalOvertimeRate: number;
  holidayOvertimeRate: number;
  workingDays: number;       // days worked this month; default 22 = full month
  normalOvertimeHours: number;
  holidayOvertimeHours: number;
  overtimeAmount: number;
  netSalary: number;
  miscItems: PayslipMiscItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BulkInitResult {
  generated: number;
  alreadyExists: number;
  skipped: { userId: string; userName: string; reason: string }[];
}

export interface PayrollSummary {
  month: number;
  year: number;
  totalPayslips: number;
  totalPayrollCost: number;
  totalOvertimeCost: number;
  totalDeductions: number;
  totalReimbursements: number;
  draftCount: number;
  lockedCount: number;
}
