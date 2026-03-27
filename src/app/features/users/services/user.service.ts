import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { User, UserCreatePayload, UserUpdatePayload, UserListParams } from '../models/user.model';
import { PageResponse } from '../../applications/services/application.service';

export interface UserListResponse {
  data: PageResponse<User>;
}

export interface UserResponse {
  data: User;
}

export interface AdminSetPasswordPayload {
  userId: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly base = `${environment.apiUrl}/user`;

  constructor(private http: HttpClient) {}

  getProfile() {
    return this.http.get<UserResponse>(`${this.base}/profile`);
  }

  updateProfile(payload: UserUpdatePayload) {
    return this.http.put<UserResponse>(`${this.base}/profile`, payload);
  }

  getAll(params?: UserListParams) {
    const httpParams: Record<string, string | number> = {};
    if (params?.role) httpParams['role'] = params.role;
    if (params?.status) httpParams['status'] = params.status;
    if (params?.search) httpParams['search'] = params.search;
    if (params?.page !== undefined) httpParams['page'] = params.page;
    if (params?.size !== undefined) httpParams['size'] = params.size;
    return this.http.get<UserListResponse>(this.base, { params: httpParams });
  }

  getById(id: string) {
    return this.http.get<UserResponse>(`${this.base}/${id}`);
  }

  update(id: string, payload: UserUpdatePayload) {
    return this.http.put<UserResponse>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<{ data: null }>(`${this.base}/${id}`);
  }

  addUserToOrg(payload: UserCreatePayload) {
    return this.http.post<UserResponse>(`${this.base}/addCustomer`, payload);
  }

  adminSetPassword(payload: AdminSetPasswordPayload) {
    return this.http.post<{ data: null }>(
      `${environment.apiUrl}/reset-password/admin/set-password`,
      payload,
    );
  }
}
