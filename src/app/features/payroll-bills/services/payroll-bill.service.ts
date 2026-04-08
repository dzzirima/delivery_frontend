import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CreateBillResult, PayrollBill, PayrollBillDetail } from '../models/payroll-bill.model';
import { Payslip } from '../../payslips/models/payslip.model';

export interface BillListResponse   { data: PayrollBill[] }
export interface BillResponse       { data: PayrollBill }
export interface CreateBillResponse { data: CreateBillResult }
export interface BillDetailResponse { data: PayrollBillDetail }
export interface PayslipResponse    { data: Payslip }

@Injectable({ providedIn: 'root' })
export class PayrollBillService {
  private readonly base = `${environment.apiUrl}/payroll-bills`;

  constructor(private http: HttpClient) {}

  listBills() {
    return this.http.get<BillListResponse>(this.base);
  }

  getBillDetail(id: string) {
    return this.http.get<BillDetailResponse>(`${this.base}/${id}`);
  }

  createBill(month: number, year: number) {
    return this.http.post<CreateBillResponse>(this.base, { month, year });
  }

  deleteBill(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  closeBill(id: string) {
    return this.http.post<BillResponse>(`${this.base}/${id}/close`, {});
  }

  regenerateBatch(id: string) {
    return this.http.post<BillResponse>(`${this.base}/${id}/regenerate-batch`, {});
  }

  deleteDraftPayslips(id: string) {
    return this.http.delete<BillResponse>(`${this.base}/${id}/draft-payslips`);
  }

  closePayslip(billId: string, payslipId: string) {
    return this.http.post<PayslipResponse>(
      `${this.base}/${billId}/payslips/${payslipId}/close`, {}
    );
  }
}
