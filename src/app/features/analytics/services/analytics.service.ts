import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ProductivityReport, OrgInfo } from '../models/analytics.model';

export interface ProductivityResponse {
  data: ProductivityReport[];
  count: number;
  success: boolean;
}

export interface OrgResponse {
  data: OrgInfo;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly base = `${environment.apiUrl}/analytics`;
  private readonly orgBase = `${environment.apiUrl}/organizations`;

  constructor(private http: HttpClient) {}

  getProductivity(params: {
    startDate?: string;
    endDate?: string;
    agentId?: string;
  }) {
    const httpParams: Record<string, string> = {};
    if (params.startDate) httpParams['startDate'] = params.startDate;
    if (params.endDate)   httpParams['endDate']   = params.endDate;
    if (params.agentId)   httpParams['agentId']   = params.agentId;
    return this.http.get<ProductivityResponse>(`${this.base}/productivity`, { params: httpParams });
  }

  getMyOrg() {
    return this.http.get<OrgResponse>(`${this.orgBase}/me`);
  }

  updateDailyTarget(dailyTarget: number) {
    return this.http.patch<OrgResponse>(`${this.orgBase}/settings`, { dailyTarget });
  }
}
