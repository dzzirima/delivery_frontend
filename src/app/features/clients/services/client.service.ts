import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface OrgClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  isActive: boolean;
}

export interface OrgClientReq {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getAll(orgId: string, search = '', page = 0, size = 50) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    return this.http.get<{ data: OrgClient[] }>(`${this.base}/org/${orgId}/clients`, { params });
  }

  create(orgId: string, req: OrgClientReq) {
    return this.http.post<{ data: OrgClient }>(`${this.base}/org/${orgId}/clients`, req);
  }

  update(orgId: string, clientId: string, req: OrgClientReq) {
    return this.http.put<{ data: OrgClient }>(`${this.base}/org/${orgId}/clients/${clientId}`, req);
  }

  delete(orgId: string, clientId: string) {
    return this.http.delete(`${this.base}/org/${orgId}/clients/${clientId}`);
  }
}
