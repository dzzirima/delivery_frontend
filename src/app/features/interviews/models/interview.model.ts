export const INTERVIEW_STATUSES = [
  'SCHEDULED',
  'RESCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_TYPES = [
  'PHONE_CALL',
  'VIDEO_CALL',
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_STAGES = [
  'PRE_SCREENING',
  'PRE_INTERVIEW',
  'FIRST_ROUND_INTERVIEW',
  'FINAL_INTERVIEW',
] as const;

export type InterviewStage = (typeof INTERVIEW_STAGES)[number];

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
  interviewType?: InterviewType;
  interviewStage?: InterviewStage;
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
  interviewType?: InterviewType;
  interviewStage?: InterviewStage;
  status: InterviewStatus;
}
