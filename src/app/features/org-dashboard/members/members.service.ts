import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'RIDER' | 'DISPATCHER';
  status: string;
  createdAt: string;
}

export interface OrgMemberReq {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'RIDER' | 'DISPATCHER';
}

export interface OrgMemberUpdateReq {
  name?: string;
  phone?: string;
  role?: 'RIDER' | 'DISPATCHER';
}

@Injectable({ providedIn: 'root' })
export class OrgMemberService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(orgId: string, role?: string) {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<{ data: OrgMember[] }>(
      `${this.base}/org/${orgId}/members`, { params });
  }

  add(orgId: string, req: OrgMemberReq) {
    return this.http.post<{ data: OrgMember }>(
      `${this.base}/org/${orgId}/members`, req);
  }

  update(orgId: string, userId: string, req: OrgMemberUpdateReq) {
    return this.http.patch<{ data: OrgMember }>(
      `${this.base}/org/${orgId}/members/${userId}`, req);
  }

  resetPassword(orgId: string, userId: string, password: string) {
    return this.http.patch(`${this.base}/org/${orgId}/members/${userId}/password`, { password });
  }

  remove(orgId: string, userId: string) {
    return this.http.delete(`${this.base}/org/${orgId}/members/${userId}`);
  }
}
