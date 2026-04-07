export const USER_ROLES = [
  'AGENT',
  'HR',
  'IT',
  'OPERATIONS',
  'MANAGER',
  'CALL_CENTER_AGENT',
  'STAFF',
  'ORG_ADMIN',
  'SYSTEM_ADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number] | 'ADMIN';

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  address: string;
  nationalId?: string;
  status: UserStatus;
  notes?: string;
  role: UserRole;
  balance: number;
  orgId?: string;
  organisationName?: string;
  department?: string;
  dateOfBirth?: string;
}

export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
  nationalId?: string;
  dateOfBirth?: string;
  role: UserRole;
  status: UserStatus;
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  status?: UserStatus;
}

export interface UserListParams {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  size?: number;
}
