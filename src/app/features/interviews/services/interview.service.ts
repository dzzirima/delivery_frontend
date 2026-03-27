import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Interview, InterviewPayload } from '../models/interview.model';

export interface InterviewListResponse {
  data: Interview[];
}

export interface InterviewResponse {
  data: Interview;
}

@Injectable({ providedIn: 'root' })
export class InterviewService {
  private readonly base = `${environment.apiUrl}/interviews`;

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<InterviewListResponse>(this.base);
  }

  getByApplicationId(applicationId: string) {
    return this.http.get<InterviewListResponse>(this.base, {
      params: { applicationId },
    });
  }

  create(payload: InterviewPayload) {
    return this.http.post<InterviewResponse>(this.base, payload);
  }

  update(id: string, payload: Partial<InterviewPayload>) {
    return this.http.put<InterviewResponse>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<{ data: null }>(`${this.base}/${id}`);
  }
}
