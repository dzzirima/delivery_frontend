export type ContractStatus = 'ACTIVE' | 'SUSPENDED';
export const CONTRACT_STATUSES: ContractStatus[] = ['ACTIVE', 'SUSPENDED'];

export type Department =
  | 'EXECUTIVE_LEADERSHIP'
  | 'BUSINESS_DEVELOPMENT'
  | 'OPERATIONS'
  | 'HUMAN_RESOURCES'
  | 'CUSTOMER_SERVICE'
  | 'INFORMATION_TECHNOLOGY'
  | 'FACILITIES_HOSPITALITY';

export const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'EXECUTIVE_LEADERSHIP',  label: 'Executive Leadership' },
  { value: 'BUSINESS_DEVELOPMENT',  label: 'Business Development' },
  { value: 'OPERATIONS',            label: 'Operations' },
  { value: 'HUMAN_RESOURCES',       label: 'Human Resources' },
  { value: 'CUSTOMER_SERVICE',      label: 'Customer Service' },
  { value: 'INFORMATION_TECHNOLOGY', label: 'Information Technology' },
  { value: 'FACILITIES_HOSPITALITY', label: 'Facilities & Hospitality' },
];

export interface Contract {
  id: string;
  userId: string;
  userName: string;
  status: ContractStatus;
  jobTitle?: string;
  department?: Department;
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
  department?: Department;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  cellphoneAllowance?: number;
  medicalAllowance?: number;
  otherAllowances?: number;
  normalOvertimeRate: number;
  holidayOvertimeRate: number;
}
