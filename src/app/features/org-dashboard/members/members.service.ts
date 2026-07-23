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
  assignedBikeId: string | null;
  assignedBikeRegNumber: string | null;
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
  private base = `${environment.apiUrl}/members`;
  constructor(private http: HttpClient) {}

  list(role?: string) {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<{ data: OrgMember[] }>(this.base, { params });
  }

  add(req: OrgMemberReq) {
    return this.http.post<{ data: OrgMember }>(this.base, req);
  }

  update(userId: string, req: OrgMemberUpdateReq) {
    return this.http.patch<{ data: OrgMember }>(`${this.base}/${userId}`, req);
  }

  resetPassword(userId: string, password: string) {
    return this.http.patch(`${this.base}/${userId}/password`, { password });
  }

  remove(userId: string) {
    return this.http.delete(`${this.base}/${userId}`);
  }
}
