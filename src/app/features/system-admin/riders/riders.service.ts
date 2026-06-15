import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface PlatformRider {
  id:          string;
  name:        string;
  email:       string;
  phoneNumber: string | null;
  status:      string;
  kycStatus:   string;
  createdAt:   string;
}

export interface RiderPage {
  content:       PlatformRider[];
  totalElements: number;
  totalPages:    number;
  number:        number;
  size:          number;
}

@Injectable({ providedIn: 'root' })
export class AdminRidersService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(page = 0, size = 20, search?: string) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    return this.http.get<{ data: RiderPage }>(`${this.base}/admin/riders`, { params });
  }

  updateStatus(riderId: string, status: string) {
    return this.http.patch(`${this.base}/admin/riders/${riderId}/status`, { status });
  }
}
