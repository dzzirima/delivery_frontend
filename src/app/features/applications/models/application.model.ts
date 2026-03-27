export const APPLICATION_STATUSES = [
  'APPLIED',
  'PENDING',
  'INTERVIEW',
  'ASSESSMENT',
  'REJECTED',
  'OFFER',
  'ON_HOLD',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_PLATFORMS = [
  'LINKEDIN',
  'INDEED',
  'COMPANY_WEBSITE',
  'EMAIL',
  'OTHER',
] as const;

export type ApplicationPlatform = (typeof APPLICATION_PLATFORMS)[number];

export const APPLICATION_TYPES = [
  'EASY_APPLY',
  'FULL_APPLICATION',
  'EMAIL_APPLICATION',
] as const;

export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export interface Application {
  id: string;
  orgId: string;
  agentId: string;
  agentName: string;
  company: string;
  position: string;
  recruitingAgent?: string;
  platform?: ApplicationPlatform;
  applicationType?: ApplicationType;
  status: ApplicationStatus;
  appliedDate: string;
  notes?: string;
  portfolioId?: string;
  portfolioName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPayload {
  company: string;
  position: string;
  recruitingAgent?: string;
  platform?: ApplicationPlatform;
  applicationType?: ApplicationType;
  status: ApplicationStatus;
  appliedDate: string;
  notes?: string;
  portfolioId?: string;
}

export interface ApplicationDetails extends Application {
  interviews: import('../../interviews/models/interview.model').Interview[];
  followUps: import('../../follow-ups/models/follow-up.model').FollowUp[];
}

export interface DuplicateCheckResult {
  duplicate: boolean;
  message: string;
  filedByAgentId?: string;
  filedAt?: string;
}
