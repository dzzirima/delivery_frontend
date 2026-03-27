export const PORTFOLIO_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];

export interface Portfolio {
  id: string;
  firstName: string;
  lastName: string;
  country?: string;
  agreedPercent?: number;
  notes?: string;
  status: PortfolioStatus;
  orgId: string;
  orgName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioPayload {
  firstName: string;
  lastName: string;
  country?: string;
  agreedPercent?: number;
  notes?: string;
  status: PortfolioStatus;
}
