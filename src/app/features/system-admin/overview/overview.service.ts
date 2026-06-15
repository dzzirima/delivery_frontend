import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface PlatformStats {
  totalUsers:         number;
  totalRiders:        number;
  totalOrganisations: number;
  totalDeliveries:    number;
  pendingDriverKyc:   number;
  pendingBikeKyc:     number;
}

@Injectable({ providedIn: 'root' })
export class SystemOverviewService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getStats() {
    return this.http.get<{ data: PlatformStats }>(`${this.base}/admin/platform/stats`);
  }
}
