import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  OnboardingInformation,
  OnboardingInformationPayload,
  OnboardingLinkPayload,
} from '../models/onboarding-information.model';

export interface OnboardingInformationListResponse {
  data: OnboardingInformation[];
}

export interface OnboardingInformationResponse {
  data: OnboardingInformation;
}

@Injectable({ providedIn: 'root' })
export class OnboardingInformationService {
  private readonly base = `${environment.apiUrl}/onboarding-information`;

  constructor(private http: HttpClient) {}

  getByApplicationId(applicationId: string) {
    return this.http.get<OnboardingInformationListResponse>(this.base, {
      params: { applicationId },
    });
  }

  getById(id: string) {
    return this.http.get<OnboardingInformationResponse>(`${this.base}/${id}`);
  }

  create(payload: OnboardingInformationPayload) {
    return this.http.post<OnboardingInformationResponse>(this.base, payload);
  }

  update(id: string, payload: Partial<OnboardingInformationPayload>) {
    return this.http.put<OnboardingInformationResponse>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addLink(onboardingId: string, payload: OnboardingLinkPayload) {
    return this.http.post<OnboardingInformationResponse>(`${this.base}/${onboardingId}/links`, payload);
  }

  updateLink(onboardingId: string, linkId: string, payload: Partial<OnboardingLinkPayload>) {
    return this.http.put<OnboardingInformationResponse>(
      `${this.base}/${onboardingId}/links/${linkId}`,
      payload,
    );
  }

  removeLink(onboardingId: string, linkId: string) {
    return this.http.delete<OnboardingInformationResponse>(
      `${this.base}/${onboardingId}/links/${linkId}`,
    );
  }
}
