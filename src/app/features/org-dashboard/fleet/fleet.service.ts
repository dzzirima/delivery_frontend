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
}

export interface BikeUpdateReq {
  make: string;
  model: string;
  licensePlate: string;
  vin?: string;
}

@Injectable({ providedIn: 'root' })
export class BikeService {
  private base = `${environment.apiUrl}/bikes`;
  constructor(private http: HttpClient) {}

  getAll(page = 0, size = 50, search?: string) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    return this.http.get<{ data: Bike[] }>(this.base, { params });
  }

  create(req: BikeReq) {
    return this.http.post<{ data: Bike }>(this.base, req);
  }

  update(bikeId: string, req: BikeUpdateReq) {
    return this.http.put<{ data: Bike }>(`${this.base}/${bikeId}`, req);
  }

  delete(bikeId: string) {
    return this.http.delete(`${this.base}/${bikeId}`);
  }

  assignRider(bikeId: string, riderId: string) {
    return this.http.post<{ data: Bike }>(`${this.base}/${bikeId}/assign/${riderId}`, {});
  }

  unassignRider(bikeId: string) {
    return this.http.delete<{ data: Bike }>(`${this.base}/${bikeId}/assign`);
  }

  /** Search all bikes globally (no org filter) — used for the invite flow */
  searchGlobal(search: string, page = 0, size = 20) {
    const params = new HttpParams()
      .set('search', search)
      .set('page', page)
      .set('size', size);
    return this.http.get<{ data: Bike[] }>(this.base, { params });
  }
}
