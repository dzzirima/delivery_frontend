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
  private base = `${environment.apiUrl}/clients`;
  constructor(private http: HttpClient) {}

  getAll(q = '', page = 0, size = 50) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q.trim()) params = params.set('q', q.trim());
    return this.http.get<{ data: OrgClient[]; length: number }>(this.base, { params });
  }

  create(req: OrgClientReq) {
    return this.http.post<{ data: OrgClient }>(this.base, req);
  }

  update(clientId: string, req: OrgClientReq) {
    return this.http.put<{ data: OrgClient }>(`${this.base}/${clientId}`, req);
  }

  delete(clientId: string) {
    return this.http.delete(`${this.base}/${clientId}`);
  }
}
