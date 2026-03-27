import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  Organization,
  OrganizationPayload,
  OrganizationListParams,
} from '../models/organization.model';
import { PageResponse } from '../../applications/services/application.service';

export interface OrganizationListResponse {
  data: PageResponse<Organization>;
}

export interface OrganizationResponse {
  data: Organization;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly base = `${environment.apiUrl}/organizations`;

  constructor(private http: HttpClient) {}

  getAll(params?: OrganizationListParams) {
    const httpParams: Record<string, string | number> = {};
    if (params?.page !== undefined) httpParams['page'] = params.page;
    if (params?.size !== undefined) httpParams['size'] = params.size;
    return this.http.get<OrganizationListResponse>(this.base, { params: httpParams });
  }

  getById(id: string) {
    return this.http.get<OrganizationResponse>(`${this.base}/${id}`);
  }

  getMyOrganization() {
    return this.http.get<OrganizationResponse>(`${this.base}/my`);
  }

  create(payload: OrganizationPayload) {
    return this.http.post<OrganizationResponse>(this.base, payload);
  }

  update(id: string, payload: Partial<OrganizationPayload>) {
    return this.http.put<OrganizationResponse>(`${this.base}/${id}`, payload);
  }

  updateMyOrganization(payload: Partial<OrganizationPayload>) {
    return this.http.put<OrganizationResponse>(`${this.base}/my`, payload);
  }

  delete(id: string) {
    return this.http.delete<{ data: null }>(`${this.base}/${id}`);
  }
}
