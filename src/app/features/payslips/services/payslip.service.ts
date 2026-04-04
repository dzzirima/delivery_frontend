import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { BulkInitResult, Payslip, PayrollSummary } from '../models/payslip.model';

export interface PayslipResponse {
  data: Payslip;
}

export interface PayslipListResponse {
  data: Payslip[];
}

export interface BulkInitResponse {
  data: BulkInitResult;
}

export interface SummaryResponse {
  data: PayrollSummary;
}

@Injectable({ providedIn: 'root' })
export class PayslipService {
  private readonly base = `${environment.apiUrl}/payslips`;

  constructor(private http: HttpClient) {}

  bulkInit(month: number, year: number) {
    return this.http.post<BulkInitResponse>(`${this.base}/bulk-init`, { month, year });
  }

  getAll(month: number, year: number) {
    return this.http.get<PayslipListResponse>(this.base, { params: { month, year } });
  }

  getSummary(month: number, year: number) {
    return this.http.get<SummaryResponse>(`${this.base}/summary`, { params: { month, year } });
  }

  getByUserId(userId: string) {
    return this.http.get<PayslipListResponse>(`${this.base}/user/${userId}`);
  }

  getById(id: string) {
    return this.http.get<PayslipResponse>(`${this.base}/${id}`);
  }

  patch(id: string, workingDays: number, normalOvertimeHours: number, holidayOvertimeHours: number) {
    return this.http.patch<PayslipResponse>(`${this.base}/${id}`, {
      workingDays,
      normalOvertimeHours,
      holidayOvertimeHours,
    });
  }

  addMiscItem(id: string, description: string, amount: number) {
    return this.http.post<PayslipResponse>(`${this.base}/${id}/misc`, { description, amount });
  }

  deleteMiscItem(id: string, miscId: string) {
    return this.http.delete<PayslipResponse>(`${this.base}/${id}/misc/${miscId}`);
  }

  regenerate(id: string) {
    return this.http.post<PayslipResponse>(`${this.base}/${id}/regenerate`, {});
  }

  finalize(id: string) {
    return this.http.post<PayslipResponse>(`${this.base}/${id}/finalize`, {});
  }

  generateIndividual(userId: string, month: number, year: number) {
    return this.http.post<PayslipResponse>(`${this.base}/generate-individual`, { userId, month, year });
  }

  resetBatch(month: number, year: number) {
    return this.http.delete<{ data: null }>(`${this.base}/batch`, { params: { month, year } });
  }
}
