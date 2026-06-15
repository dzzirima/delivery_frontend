import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface PlatformOrg {
  id:                          string;
  name:                        string;
  slug:                        string;
  contactPhone:                string | null;
  contactEmail:                string | null;
  businessRegistrationNumber:  string | null;
  status:                      string;
  createdAt:                   string;
}

export interface OrgPage {
  content:       PlatformOrg[];
  totalElements: number;
  totalPages:    number;
  number:        number;
  size:          number;
}

@Injectable({ providedIn: 'root' })
export class AdminOrgsService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(page = 0, size = 20, search?: string) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    return this.http.get<{ data: OrgPage }>(`${this.base}/admin/organisations`, { params });
  }

  updateStatus(orgId: string, status: string) {
    return this.http.patch(`${this.base}/admin/organisations/${orgId}/status`, { status });
  }
}
