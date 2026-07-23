import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface BikeOrgInvite {
  id: string;
  bikeId: string;
  bikeMake: string;
  bikeModel: string;
  bikeLicensePlate: string;
  bikeOwnerName: string;
  organisationId: string;
  organisationName: string;
  invitedByName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class BikeOrgInviteService {
  private base = `${environment.apiUrl}/bike-invites`;
  constructor(private http: HttpClient) {}

  send(bikeId: string) {
    return this.http.post<{ data: BikeOrgInvite }>(this.base, { bikeId });
  }

  list() {
    return this.http.get<{ data: BikeOrgInvite[] }>(this.base);
  }

  cancel(inviteId: string) {
    return this.http.delete(`${this.base}/${inviteId}`);
  }
}
