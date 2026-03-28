import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { DashboardSummary, DashboardAnalytics } from '../models/dashboard.model';

interface ApiResponse<T> { data: T; }

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private base = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getSummary() {
    return this.http.get<ApiResponse<DashboardSummary>>(`${this.base}/summary`);
  }

  getAnalytics(params: { startDate?: string; endDate?: string; agentId?: string } = {}) {
    const p: Record<string, string> = {};
    if (params.startDate) p['startDate'] = params.startDate;
    if (params.endDate)   p['endDate']   = params.endDate;
    if (params.agentId)   p['agentId']   = params.agentId;
    return this.http.get<ApiResponse<DashboardAnalytics>>(`${this.base}/analytics`, { params: p });
  }
}
