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
  private base = `${environment.apiUrl}/shops`;
  constructor(private http: HttpClient) {}

  getAll(page = 0, size = 20, q?: string) {
    let url = `${this.base}?page=${page}&size=${size}`;
    if (q?.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
    return this.http.get<{ data: Shop[]; length: number }>(url);
  }

  getById(shopId: string) {
    return this.http.get<{ data: Shop }>(`${this.base}/${shopId}`);
  }

  create(req: ShopReq) {
    return this.http.post<{ data: Shop }>(this.base, req);
  }

  update(shopId: string, req: ShopReq) {
    return this.http.put<{ data: Shop }>(`${this.base}/${shopId}`, req);
  }

  delete(shopId: string) {
    return this.http.delete(`${this.base}/${shopId}`);
  }
}
