import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Portfolio, PortfolioPayload } from '../models/portfolio.model';

export interface PortfolioPageResponse {
  content: Portfolio[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface PortfolioListResponse {
  data: PortfolioPageResponse;
}

export interface PortfolioResponse {
  data: Portfolio;
}

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly base = `${environment.apiUrl}/portfolios`;

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<PortfolioListResponse>(this.base);
  }

  getActive() {
    return this.http.get<PortfolioListResponse>(this.base, { params: { status: 'ACTIVE' } });
  }

  getById(id: string) {
    return this.http.get<PortfolioResponse>(`${this.base}/${id}`);
  }

  create(payload: PortfolioPayload) {
    return this.http.post<PortfolioResponse>(this.base, payload);
  }

  update(id: string, payload: Partial<PortfolioPayload>) {
    return this.http.put<PortfolioResponse>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<{ data: null }>(`${this.base}/${id}`);
  }
}
