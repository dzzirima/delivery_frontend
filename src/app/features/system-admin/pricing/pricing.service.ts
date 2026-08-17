import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface PricingConfig {
  baseFare:          number;
  baseRadiusKm:      number;
  perExtraKmRate:    number;
  serviceFeePercent: number;
  minimumFare:       number;
}

@Injectable({ providedIn: 'root' })
export class PricingService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getConfig() {
    return this.http.get<{ data: PricingConfig }>(`${this.base}/admin/pricing/config`);
  }

  updateConfig(body: PricingConfig) {
    return this.http.put<{ data: PricingConfig }>(`${this.base}/admin/pricing/config`, body);
  }
}
