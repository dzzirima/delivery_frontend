import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  status: string;
  role: string;
}

export interface UserListParams {
  page?: number;
  size?: number;
  status?: string;
  role?: string;
  search?: string;
}

export interface UserPage {
  content: User[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface UpdateUserPayload {
  email?: string;
  name?: string;
  phoneNumber?: string;
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly base = `${environment.apiUrl}/user`;

  readonly profile = signal<User | null>(null);

  constructor(private http: HttpClient) {}

  getAll(filters: UserListParams = {}) {
    let params = new HttpParams();
    if (filters.page != null) params = params.set('page', filters.page);
    if (filters.size != null) params = params.set('size', filters.size);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.role) params = params.set('role', filters.role);
    if (filters.search) params = params.set('search', filters.search);
    return this.http.get<{ data: UserPage }>(this.base, { params });
  }

  getById(id: string) {
    return this.http.get<{ data: User }>(`${this.base}/${id}`);
  }

  getMyProfile() {
    return this.http.get<{ data: User }>(`${this.base}/profile`).pipe(
      tap(res => this.profile.set(res.data)),
    );
  }

  update(id: string, payload: UpdateUserPayload) {
    return this.http.put<{ data: User }>(`${this.base}/${id}`, payload).pipe(
      tap(res => this.profile.set(res.data)),
    );
  }

  delete(id: string) {
    return this.http.delete<{ data: User }>(`${this.base}/${id}`);
  }

  forgotPassword(email: string) {
    return this.http.post(`${environment.apiUrl}/reset-password/forgot`, { email });
  }

  resetPassword(code: string, newPassword: string) {
    return this.http.post(`${environment.apiUrl}/reset-password/reset`, { code, newPassword });
  }
}
