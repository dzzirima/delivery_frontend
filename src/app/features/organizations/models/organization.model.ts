export const ORGANIZATION_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  status: OrganizationStatus;
  createdAt: string;
}

export interface OrganizationPayload {
  name: string;
  slug: string;
  email: string;
  phone?: string;
}

export interface OrganizationListParams {
  page?: number;
  size?: number;
}
