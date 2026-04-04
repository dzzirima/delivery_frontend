export type GigStatus = 'LIVE' | 'DROPPED';
export type EquipmentType = 'COMPANY_OFFER' | 'OWN_EQUIPMENT';
export type OvertimeStatus = 'APPROVED' | 'DENIED';

export const EQUIPMENT_TYPES: EquipmentType[] = ['COMPANY_OFFER', 'OWN_EQUIPMENT'];
export const OVERTIME_STATUSES: OvertimeStatus[] = ['APPROVED', 'DENIED'];

export interface Overtime {
  id: string;
  gigId: string;
  overtimeHours: number;
  overtimeDate: string;
  status: OvertimeStatus;
  createdAt: string;
}

export interface Gig {
  id: string;
  applicationId: string;
  company: string;
  position: string;
  workerId: string | null;
  workerName: string | null;
  portfolioId: string | null;
  portfolioName: string | null;
  startingDate: string;
  payRate: number;
  maximumHoursPerDay: number | null;
  equipmentType: EquipmentType;
  computerInformation: string | null;
  duration: number;
  possibilityOfExtension: boolean;
  status: GigStatus;
  reasonsOfDrop: string | null;
  overtimeRate: number;
  overtimes: Overtime[];
  overtimeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GigPayload {
  applicationId: string;
  workerId?: string | null;
  startingDate: string;
  payRate: number;
  maximumHoursPerDay?: number | null;
  equipmentType: EquipmentType;
  computerInformation?: string | null;
  duration: number;
  possibilityOfExtension: boolean;
  overtimeRate: number;
}

export interface GigPatch {
  workerId?: string | null;
  clearWorker?: boolean;
  startingDate?: string;
  payRate?: number;
  maximumHoursPerDay?: number | null;
  equipmentType?: EquipmentType;
  computerInformation?: string | null;
  duration?: number;
  possibilityOfExtension?: boolean;
  overtimeRate?: number;
}

export interface GigStatusPayload {
  status: GigStatus;
  reasonsOfDrop?: string | null;
}

export interface OvertimePayload {
  overtimeHours: number;
  overtimeDate: string;
  status?: OvertimeStatus;
}
