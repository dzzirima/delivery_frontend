export const ONBOARDING_TYPES = [
  'TECHNICAL_ENGINEERING',
  'OPERATIONAL_HR',
  'PRODUCT_DOMAIN',
  'REMOTE_ASYNCHRONOUS',
  'GENERAL',
] as const;

export type OnboardingType = (typeof ONBOARDING_TYPES)[number];

export const ONBOARDING_STATUSES = [
  'PENDING',
  'COMPLETED',
  'MISSED',
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export interface OnboardingLink {
  id: string;
  url: string;
  label?: string;
  expiryDate?: string; // ISO date "yyyy-MM-dd"
  createdAt: string;
}

export interface OnboardingInformation {
  id: string;
  applicationId: string;
  notes: string;
  onBoardingDate: string | null;
  type?: OnboardingType;
  status?: OnboardingStatus;
  links: OnboardingLink[];
  createdAt: string;
  updatedAt?: string;
}

export interface OnboardingInformationPayload {
  applicationId: string;
  notes: string;
  onBoardingDate?: string | null;
  type?: OnboardingType;
  status?: OnboardingStatus;
}

export interface OnboardingLinkPayload {
  url: string;
  label?: string;
  expiryDate?: string;
}
