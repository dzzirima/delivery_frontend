export interface OnboardingInformation {
  id: string;
  applicationId: string;
  notes: string;
  onBoardingDate: string | null;
  createdAt: string;
}

export interface OnboardingInformationPayload {
  applicationId: string;
  notes: string;
  onBoardingDate?: string | null;
}
