export const USER_ROLES = [
  'AGENT',
  'ORG_ADMIN',
  'SYSTEM_ADMIN',
  'ADMIN',
  'CUSTOMER',
  'RIDER',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  address: string;
  status: UserStatus;
  notes?: string;
  role: UserRole;
  balance: number;
  orgId?: string;
  organisationName?: string;
}

export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
  role: UserRole;
  status: UserStatus;
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
}

export interface UserListParams {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  size?: number;
}
