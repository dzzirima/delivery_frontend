import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface ShopItem {
  id: string;
  shopId: string;
  shopName: string;
  name: string;
  description: string;
  sku: string;
  unit: string;
  isActive: boolean;
}

export interface ShopItemReq {
  name: string;
  description?: string;
  sku?: string;
  unit?: string;
}

@Injectable({ providedIn: 'root' })
export class ShopItemService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  /** All items — org-scoped for org users, global for SYSTEM_ADMIN. */
  getAll(page = 0, size = 20, q?: string) {
    let url = `${this.base}/shop-items?page=${page}&size=${size}`;
    if (q?.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
    return this.http.get<{ data: ShopItem[]; length: number }>(url);
  }

  /** Items within a specific shop. */
  getByShop(shopId: string, page = 0, size = 20, q?: string) {
    let url = `${this.base}/shops/${shopId}/items?page=${page}&size=${size}`;
    if (q?.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
    return this.http.get<{ data: ShopItem[]; length: number }>(url);
  }

  create(shopId: string, req: ShopItemReq) {
    return this.http.post<{ data: ShopItem }>(`${this.base}/shops/${shopId}/items`, req);
  }

  update(itemId: string, req: ShopItemReq) {
    return this.http.put<{ data: ShopItem }>(`${this.base}/shop-items/${itemId}`, req);
  }

  delete(itemId: string) {
    return this.http.delete(`${this.base}/shop-items/${itemId}`);
  }
}
