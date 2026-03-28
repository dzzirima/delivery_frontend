export interface ProductivityReport {
  agentId: string;
  agentName: string;
  totalApplications: number;
  periodTarget: number;
  variance: number;
  successPercentage: number;
}

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  status: string;
  dailyTarget: number;
  createdAt: string;
}
