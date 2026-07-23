import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface PlatformUser {
  id:                   string;
  name:                 string;
  email:                string;
  phoneNumber:          string | null;
  role:                 string;
  status:               string;
  createdAt:            string;
  assignedBikeId:       string | null;
  assignedBikeRegNumber: string | null;
}

export interface UserPage {
  content:       PlatformUser[];
  totalElements: number;
  totalPages:    number;
  number:        number;
  size:          number;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(page = 0, size = 20, role?: string, search?: string) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (role)   params = params.set('role', role);
    if (search) params = params.set('search', search);
    return this.http.get<{ data: UserPage }>(`${this.base}/admin/users`, { params });
  }

  updateStatus(userId: string, status: string) {
    return this.http.patch(`${this.base}/admin/users/${userId}/status`, { status });
  }
}
