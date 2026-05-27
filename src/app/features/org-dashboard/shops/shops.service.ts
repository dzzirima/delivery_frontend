import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface Shop {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface ShopReq {
  name: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

@Injectable({ providedIn: 'root' })
export class ShopService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getAll(orgId: string) {
    return this.http.get<{ data: Shop[] }>(`${this.base}/org/${orgId}/shops?size=100`);
  }

  create(orgId: string, req: ShopReq) {
    return this.http.post<{ data: Shop }>(`${this.base}/org/${orgId}/shops`, req);
  }

  update(orgId: string, shopId: string, req: ShopReq) {
    return this.http.put<{ data: Shop }>(`${this.base}/org/${orgId}/shops/${shopId}`, req);
  }

  delete(orgId: string, shopId: string) {
    return this.http.delete(`${this.base}/org/${orgId}/shops/${shopId}`);
  }
}
