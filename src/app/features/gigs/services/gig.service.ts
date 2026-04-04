import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Gig, GigPayload, GigPatch, GigStatusPayload, Overtime, OvertimePayload } from '../models/gig.model';

export interface GigListResponse {
  data: Gig[];
}

export interface GigResponse {
  data: Gig | null;
}

export interface OvertimeResponse {
  data: Overtime;
}

export interface OvertimeListResponse {
  data: Overtime[];
}

export interface GigStats {
  liveCount: number;
  droppedCount: number;
  totalCount: number;
}

export interface GigStatsResponse {
  data: GigStats;
}

@Injectable({ providedIn: 'root' })
export class GigService {
  private readonly base = `${environment.apiUrl}/gigs`;

  constructor(private http: HttpClient) {}

  /** Returns all gigs for the org (no applicationId param). */
  getAll() {
    return this.http.get<GigListResponse>(this.base);
  }

  /** Returns the single gig for a specific application, or null if none. */
  getByApplicationId(applicationId: string) {
    return this.http.get<GigResponse>(this.base, { params: { applicationId } });
  }

  /** Returns all live gigs linked to a portfolio entry. */
  getLiveByPortfolioId(portfolioId: string) {
    return this.http.get<GigListResponse>(this.base, { params: { portfolioId } });
  }

  getById(id: string) {
    return this.http.get<GigResponse>(`${this.base}/${id}`);
  }

  getStats() {
    return this.http.get<GigStatsResponse>(`${this.base}/stats`);
  }

  create(payload: GigPayload) {
    return this.http.post<GigResponse>(this.base, payload);
  }

  patch(id: string, payload: GigPatch) {
    return this.http.patch<GigResponse>(`${this.base}/${id}`, payload);
  }

  updateStatus(id: string, payload: GigStatusPayload) {
    return this.http.put<GigResponse>(`${this.base}/${id}/status`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addOvertime(gigId: string, payload: OvertimePayload) {
    return this.http.post<OvertimeResponse>(`${this.base}/${gigId}/overtime`, payload);
  }

  getOvertime(gigId: string) {
    return this.http.get<OvertimeListResponse>(`${this.base}/${gigId}/overtime`);
  }

  deleteOvertime(gigId: string, overtimeId: string) {
    return this.http.delete<void>(`${this.base}/${gigId}/overtime/${overtimeId}`);
  }
}
