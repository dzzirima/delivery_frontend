import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface OrgDashboardStats {
  todayDeliveries: number;
  totalBikes: number;
  totalShops: number;
  totalClients: number;
}

@Injectable({ providedIn: 'root' })
export class OrgDashboardService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getStats(orgId: string) {
    return this.http.get<{ data: OrgDashboardStats }>(`${this.base}/org/${orgId}/dashboard/stats`);
  }
}
