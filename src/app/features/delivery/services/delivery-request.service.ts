import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface DriverBid {
  requestId:        string;
  driverId:         string;
  driverName:       string;
  driverPhone?:     string;
  bikeMake?:        string;
  bikeModel?:       string;
  licensePlate?:    string;
  distanceKm?:      number;
  estimatedMinutes?: number;
  offeredPrice?:    number;
}

@Injectable({ providedIn: 'root' })
export class DeliveryRequestService {
  private base = `${environment.apiUrl}/deliveries`;

  constructor(private http: HttpClient) {}

  // Creates a delivery (PUBLIC_BID flow). Returns the DB delivery record — use `data.id` as the deliveryId.
  createRequest(body: object) {
    return this.http.post<{ data: { id: string; [key: string]: unknown } }>(
      this.base, body
    );
  }

  placeBid(deliveryId: string, body: object) {
    return this.http.post<{ data: unknown }>(
      `${this.base}/${deliveryId}/bids`, body
    );
  }

  acceptBid(deliveryId: string, driverId: string) {
    return this.http.patch<{ data: { id: string; agreedPrice: number } }>(
      `${this.base}/${deliveryId}/bids/accept`, { driverId }
    );
  }

  repriceRequest(deliveryId: string, price: number) {
    return this.http.patch<{ data: { id: string; price: number } }>(
      `${this.base}/${deliveryId}/reprice`, { price }
    );
  }

  cancelRequest(deliveryId: string, reason?: string) {
    const body: Record<string, string> = {};
    if (reason) body['reason'] = reason;
    return this.http.patch(
      `${this.base}/${deliveryId}/cancel`, body
    );
  }

  getJobMarket(minAgeMinutes = 1) {
    return this.http.get<{ data: unknown[] }>(
      `${this.base}/market`, { params: { minAgeMinutes: String(minAgeMinutes) } }
    );
  }
}
