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
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createRequest(body: object) {
    return this.http.post<{ data: { requestId: string } }>(
      `${this.base}/delivery/request`, body
    );
  }

  acceptBid(requestId: string, driverId: string) {
    return this.http.post<{ data: { deliveryId: string; agreedPrice: number } }>(
      `${this.base}/delivery/request/${requestId}/accept`, { driverId }
    );
  }

  repriceRequest(requestId: string, price: number) {
    return this.http.post<{ data: { requestId: string; price: number } }>(
      `${this.base}/delivery/request/${requestId}/reprice`, { price }
    );
  }

  cancelRequest(requestId: string, reason?: string) {
    const body: Record<string, string> = {};
    if (reason) body['reason'] = reason;
    return this.http.post(
      `${this.base}/delivery/request/${requestId}/cancel`, body
    );
  }
}
