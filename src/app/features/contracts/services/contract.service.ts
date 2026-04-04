import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Contract, ContractPayload, ContractStatus } from '../models/contract.model';

export interface ContractResponse {
  data: Contract;
}

export interface ContractNullableResponse {
  data: Contract | null;
}

export interface ContractListResponse {
  data: Contract[];
}

@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly base = `${environment.apiUrl}/contracts`;

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<ContractListResponse>(this.base);
  }

  getByUserId(userId: string) {
    return this.http.get<ContractNullableResponse>(`${this.base}/user/${userId}`);
  }

  create(payload: ContractPayload) {
    return this.http.post<ContractResponse>(this.base, payload);
  }

  update(id: string, payload: ContractPayload) {
    return this.http.put<ContractResponse>(`${this.base}/${id}`, payload);
  }

  updateStatus(id: string, status: ContractStatus) {
    return this.http.patch<ContractResponse>(`${this.base}/${id}/status`, null, {
      params: { status },
    });
  }
}
