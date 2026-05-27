import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface Bike {
  id: string;
  make: string;
  model: string;
  licensePlate: string;
  vin: string;
  status: string;
  ownerName: string;
  organisationId: string;
  online: boolean;
  assignedRiderId: string | null;
  assignedRiderName: string | null;
}

export interface BikeReq {
  make: string;
  model: string;
  licensePlate: string;
  vin?: string;
  organisationId: string;
}

export interface BikeUpdateReq {
  make: string;
  model: string;
  licensePlate: string;
  vin?: string;
}

@Injectable({ providedIn: 'root' })
export class BikeService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getAll(orgId: string, page = 0, size = 50, search?: string) {
    let params = new HttpParams()
      .set('organisationId', orgId)
      .set('page', page)
      .set('size', size);
    if (search) params = params.set('search', search);
    return this.http.get<{ data: Bike[] }>(`${this.base}/bikes`, { params });
  }

  create(req: BikeReq) {
    return this.http.post<{ data: Bike }>(`${this.base}/bikes`, req);
  }

  update(bikeId: string, req: BikeUpdateReq) {
    return this.http.put<{ data: Bike }>(`${this.base}/bikes/${bikeId}`, req);
  }

  delete(bikeId: string) {
    return this.http.delete(`${this.base}/bikes/${bikeId}`);
  }

  assignRider(bikeId: string, riderId: string) {
    return this.http.patch<{ data: Bike }>(
      `${this.base}/bikes/${bikeId}/assign-rider?riderId=${riderId}`, {});
  }

  unassignRider(bikeId: string) {
    return this.http.patch<{ data: Bike }>(
      `${this.base}/bikes/${bikeId}/unassign-rider`, {});
  }

  /** Search all bikes globally (no org filter) — used for the invite flow */
  searchGlobal(search: string, page = 0, size = 20) {
    const params = new HttpParams()
      .set('search', search)
      .set('page', page)
      .set('size', size);
    return this.http.get<{ data: Bike[] }>(`${this.base}/bikes`, { params });
  }
}
