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
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  send(orgId: string, bikeId: string) {
    return this.http.post<{ data: BikeOrgInvite }>(`${this.base}/org/${orgId}/bike-invites`, { bikeId });
  }

  list(orgId: string) {
    return this.http.get<{ data: BikeOrgInvite[] }>(`${this.base}/org/${orgId}/bike-invites`);
  }

  cancel(orgId: string, inviteId: string) {
    return this.http.delete(`${this.base}/org/${orgId}/bike-invites/${inviteId}`);
  }
}
