import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Interview, InterviewPayload } from '../models/interview.model';
import { PageResponse } from '../../applications/services/application.service';

export interface InterviewListResponse {
  data: PageResponse<Interview>;
}

export interface InterviewResponse {
  data: Interview;
}

export interface InterviewListParams {
  applicationId?: string;
  status?: string;
  search?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class InterviewService {
  private readonly base = `${environment.apiUrl}/interviews`;

  constructor(private http: HttpClient) {}

  getAll(params?: InterviewListParams) {
    const httpParams: Record<string, string | number> = {};
    if (params?.applicationId) httpParams['applicationId'] = params.applicationId;
    if (params?.status) httpParams['status'] = params.status;
    if (params?.search) httpParams['search'] = params.search;
    if (params?.page !== undefined) httpParams['page'] = params.page;
    if (params?.size !== undefined) httpParams['size'] = params.size;
    return this.http.get<InterviewListResponse>(this.base, { params: httpParams });
  }

  getByApplicationId(applicationId: string) {
    return this.http.get<InterviewListResponse>(this.base, {
      params: { applicationId },
    });
  }

  getById(id: string) {
    return this.http.get<InterviewResponse>(`${this.base}/${id}`);
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
