import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FollowUp, FollowUpPayload } from '../models/follow-up.model';

export interface FollowUpListResponse {
  data: FollowUp[];
}

export interface FollowUpResponse {
  data: FollowUp;
}

@Injectable({ providedIn: 'root' })
export class FollowUpService {
  private readonly base = `${environment.apiUrl}/follow-ups`;

  constructor(private http: HttpClient) {}

  getByApplicationId(applicationId: string) {
    return this.http.get<FollowUpListResponse>(this.base, {
      params: { applicationId },
    });
  }

  create(payload: FollowUpPayload) {
    return this.http.post<FollowUpResponse>(this.base, payload);
  }
}
