export type ContractStatus = 'ACTIVE' | 'SUSPENDED';
export const CONTRACT_STATUSES: ContractStatus[] = ['ACTIVE', 'SUSPENDED'];

export interface Contract {
  id: string;
  userId: string;
  userName: string;
  status: ContractStatus;
  jobTitle?: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  cellphoneAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  normalOvertimeRate: number;
  holidayOvertimeRate: number;
  lastUpdatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractPayload {
  userId: string;
  status?: ContractStatus;
  jobTitle?: string;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  cellphoneAllowance?: number;
  medicalAllowance?: number;
  otherAllowances?: number;
  normalOvertimeRate: number;
  holidayOvertimeRate: number;
}
