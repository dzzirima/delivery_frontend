export interface DashboardSummary {
  totalApplications: number;
  totalAgents: number;
  totalPortfolio: number;
  upcomingInterviews: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface AgentRank {
  agentId: string;
  agentName: string;
  count: number;
}

export interface RecentApplication {
  id: string;
  company: string;
  position: string;
  status: string;
  agentName: string;
  appliedDate: string;
}

export interface DashboardAnalytics {
  statusBreakdown: StatusCount[];
  agentLeaderboard: AgentRank[];
  recentApplications: RecentApplication[];
}
