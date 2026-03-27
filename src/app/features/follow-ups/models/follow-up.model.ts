export interface FollowUp {
  id: string;
  applicationId: string;
  message: string;
  followUpDate: string;
  createdAt: string;
}

export interface FollowUpPayload {
  applicationId: string;
  message: string;
  followUpDate: string;
}
