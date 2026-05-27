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

  getAllByOrg(orgId: string) {
    return this.http.get<{ data: ShopItem[] }>(`${this.base}/org/${orgId}/items?size=200`);
  }

  getAllByShop(orgId: string, shopId: string, page = 0, size = 20, search?: string) {
    let url = `${this.base}/org/${orgId}/shops/${shopId}/items?page=${page}&size=${size}`;
    if (search?.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    return this.http.get<{ data: ShopItem[]; length: number }>(url);
  }

  create(orgId: string, shopId: string, req: ShopItemReq) {
    return this.http.post<{ data: ShopItem }>(`${this.base}/org/${orgId}/shops/${shopId}/items`, req);
  }

  update(orgId: string, shopId: string, itemId: string, req: ShopItemReq) {
    return this.http.put<{ data: ShopItem }>(`${this.base}/org/${orgId}/shops/${shopId}/items/${itemId}`, req);
  }

  delete(orgId: string, shopId: string, itemId: string) {
    return this.http.delete(`${this.base}/org/${orgId}/shops/${shopId}/items/${itemId}`);
  }
}
