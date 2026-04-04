import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  Application,
  ApplicationDetails,
  ApplicationPayload,
  DuplicateCheckResult,
} from '../models/application.model';

export interface ApplicationStats {
  total: number;
  applied: number;
  pending: number;
  interview: number;
  assessment: number;
  rejected: number;
  offer: number;
  onHold: number;
}

export interface ApplicationStatsResponse {
  data: ApplicationStats;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApplicationListResponse {
  data: PageResponse<Application>;
}

export interface ApplicationResponse {
  data: Application;
}

export interface ApplicationDetailsResponse {
  data: ApplicationDetails;
}

export interface DuplicateCheckResponse {
  data: DuplicateCheckResult;
}

export interface ApplicationListParams {
  status?: string;
  agentId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly base = `${environment.apiUrl}/applications`;

  constructor(private http: HttpClient) {}

  getAll(params?: ApplicationListParams) {
    const httpParams: Record<string, string | number> = {};
    if (params?.status)   httpParams['status']   = params.status;
    if (params?.agentId)  httpParams['agentId']  = params.agentId;
    if (params?.fromDate) httpParams['fromDate']  = params.fromDate;
    if (params?.toDate)   httpParams['toDate']    = params.toDate;
    if (params?.search)   httpParams['search']   = params.search;
    if (params?.page !== undefined) httpParams['page'] = params.page;
    if (params?.size !== undefined) httpParams['size'] = params.size;
    return this.http.get<ApplicationListResponse>(this.base, { params: httpParams });
  }

  getStats(params?: { agentId?: string; fromDate?: string; toDate?: string }) {
    const httpParams: Record<string, string> = {};
    if (params?.agentId)  httpParams['agentId']  = params.agentId;
    if (params?.fromDate) httpParams['fromDate']  = params.fromDate;
    if (params?.toDate)   httpParams['toDate']    = params.toDate;
    return this.http.get<ApplicationStatsResponse>(`${this.base}/stats`, { params: httpParams });
  }

  getById(id: string) {
    return this.http.get<ApplicationResponse>(`${this.base}/${id}`);
  }

  getDetails(id: string) {
    return this.http.get<ApplicationDetailsResponse>(`${this.base}/${id}/details`);
  }

  duplicateCheck(company: string) {
    return this.http.get<DuplicateCheckResponse>(`${this.base}/duplicate-check`, {
      params: { company },
    });
  }

  create(payload: ApplicationPayload) {
    return this.http.post<ApplicationResponse>(this.base, payload);
  }

  update(id: string, payload: Partial<ApplicationPayload>) {
    return this.http.put<ApplicationResponse>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<{ data: null }>(`${this.base}/${id}`);
  }
}
