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
  applicationId: string;
  interviewDateTime: string;
  interviewerName?: string;
  interviewerPhone?: string;
  documentsRequired?: string;
  meetingLinkOrLocation?: string;
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
  meetingLinkOrLocation?: string;
  notes?: string;
  status: InterviewStatus;
}
