export const INTERVIEW_STATUSES = [
  'SCHEDULED',
  'RESCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export interface Interview {
  id: string;
  orgId: string;
  agentId: string;
  agentName: string;
  applicationId: string;
  company: string;
  interviewDateTime: string;
  interviewerName?: string;
  interviewerPhone?: string;
  documentsRequired?: string;
  locationOrLink?: string;
  notes?: string;
  status: InterviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewPayload {
  applicationId: string;
  interviewDateTime: string;
  interviewerName?: string;
  interviewerPhone?: string;
  documentsRequired?: string;
  locationOrLink?: string;
  notes?: string;
  status: InterviewStatus;
}
