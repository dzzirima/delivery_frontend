import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface DeliveryItem {
  id: string;
  status: string;
  dispatchStrategy: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  distanceKm: number | null;
  estimatedDurationMinutes: number | null;
  clientName: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  assignedByName: string | null;
  shopId: string | null;
  shopName: string | null;
  price: number;
  paymentStatus: string | null;
  description: string | null;
  priority: string | null;
  createdAt: string;
  updatedAt: string | null;
  actualPickupTime: string | null;
  actualDeliveryTime: string | null;
}

export interface OrgRider {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface DeliveryStats {
  assigned: number;
  accepted: number;
  inTransit: number;
  arrived: number;
  declined: number;
  published: number;
  delivered: number;
  cancelled: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class OrgDeliveryService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getBoard(orgId: string, status?: string, page = 0, size = 30) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get<{ data: DeliveryItem[]; length: number }>(
      `${this.base}/org/${orgId}/dispatch`, { params });
  }

  getRiders(orgId: string) {
    return this.http.get<{ data: OrgRider[] }>(`${this.base}/org/${orgId}/dispatch/riders`);
  }

  getStats(orgId: string) {
    return this.http.get<{ data: DeliveryStats }>(`${this.base}/org/${orgId}/dispatch/stats`);
  }

  cancel(orgId: string, id: string) {
    return this.http.patch(`${this.base}/org/${orgId}/dispatch/${id}/cancel`, {});
  }

  reassign(orgId: string, id: string, driverId: string) {
    return this.http.patch(`${this.base}/org/${orgId}/dispatch/${id}/reassign`, { driverId });
  }

  publish(orgId: string, id: string) {
    return this.http.patch(`${this.base}/org/${orgId}/dispatch/${id}/publish`, {});
  }

  createDelivery(orgId: string, body: object) {
    return this.http.post<{ data: DeliveryItem }>(`${this.base}/org/${orgId}/delivery`, body);
  }

  updateDelivery(orgId: string, id: string, body: object) {
    return this.http.patch<{ data: DeliveryItem }>(`${this.base}/org/${orgId}/dispatch/${id}`, body);
  }
}
