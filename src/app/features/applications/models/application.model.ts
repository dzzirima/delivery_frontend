export const APPLICATION_STATUSES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEWING',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PROFILE_NAMES = ['Peter', 'Nyasha'] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

export interface Application {
  id: string;
  profileName: ProfileName;
  company: string;
  position: string;
  recruitingAgent?: string;
  platform?: string;
  status: ApplicationStatus;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPayload {
  profileName: ProfileName;
  company: string;
  position: string;
  recruitingAgent?: string;
  platform?: string;
  status: ApplicationStatus;
  followUpDate?: string;
  notes?: string;
}
