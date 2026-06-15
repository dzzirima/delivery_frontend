import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface DeliveryDetail {
  id: string;
  status: string;
  dispatchStrategy: string | null;
  requestScope: string | null;
  route: {
    pickupAddress: string;
    pickupLat: number | null;
    pickupLng: number | null;
    dropoffAddress: string;
    dropoffLat: number | null;
    dropoffLng: number | null;
    dropoffInstructions: string | null;
    distanceKm: number | null;
    estimatedDurationMinutes: number | null;
  };
  client: { name: string; phone: string | null; address: string | null; } | null;
  driver: { id: string; name: string; phone: string | null; bikeMake: string | null; bikeModel: string | null; licensePlate: string | null; } | null;
  packageDetails: { description: string | null; sizeCategory: string | null; priority: string | null; weight: number | null; };
  financials: { price: number; paymentMethod: string | null; paymentStatus: string | null; };
  timeline: { createdAt: string; pickedUpAt: string | null; deliveredAt: string | null; cancelledAt: string | null; };
  assignedBy: string | null;
  notes: string | null;
  cancellationReason: string | null;
}

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
  private base = `${environment.apiUrl}/deliveries`;
  constructor(private http: HttpClient) {}

  getBoard(status?: string, page = 0, size = 30) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get<{ data: DeliveryItem[]; length: number }>(this.base, { params });
  }

  getStats() {
    return this.http.get<{ data: DeliveryStats }>(`${this.base}/stats`);
  }

  cancel(id: string) {
    return this.http.patch(`${this.base}/${id}/cancel`, {});
  }

  reassign(id: string, driverId: string) {
    return this.http.patch(`${this.base}/${id}/reassign`, { driverId });
  }

  publish(id: string) {
    return this.http.patch(`${this.base}/${id}/publish`, {});
  }

  createDelivery(body: object) {
    return this.http.post<{ data: DeliveryItem }>(this.base, body);
  }

  getDetail(id: string) {
    return this.http.get<{ data: DeliveryDetail }>(`${this.base}/${id}`);
  }

  updateDelivery(id: string, body: object) {
    return this.http.patch<{ data: DeliveryItem }>(`${this.base}/${id}`, body);
  }
}
