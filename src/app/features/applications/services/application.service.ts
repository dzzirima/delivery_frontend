import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Application, ApplicationPayload } from '../models/application.model';

export interface ApplicationListResponse {
  data: {
    content: Application[];
    totalElements: number;
  };
}

export interface ApplicationResponse {
  data: Application;
}

export interface ApplicationListParams {
  profileName?: string;
  status?: string;
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
    if (params?.profileName) httpParams['profileName'] = params.profileName;
    if (params?.status) httpParams['status'] = params.status;
    if (params?.search) httpParams['search'] = params.search;
    if (params?.page !== undefined) httpParams['page'] = params.page;
    if (params?.size !== undefined) httpParams['size'] = params.size;
    return this.http.get<ApplicationListResponse>(this.base, { params: httpParams });
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
