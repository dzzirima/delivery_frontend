import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PricingConfig, PricingService } from './pricing.service';

@Component({
  selector: 'app-pricing-config',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './pricing.html',
})
export class PricingConfigComponent implements OnInit {

  loading = signal(false);
  saving  = signal(false);
  error   = signal('');
  success = signal('');

  form: PricingConfig = {
    baseFare:          0,
    baseRadiusKm:      0,
    perExtraKmRate:    0,
    serviceFeePercent: 0,
    minimumFare:       0,
  };

  constructor(private pricingService: PricingService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.pricingService.getConfig().subscribe({
      next:  r => { this.form = { ...r.data }; this.loading.set(false); },
      error: () => { this.error.set('Failed to load pricing config.'); this.loading.set(false); },
    });
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.pricingService.updateConfig(this.form).subscribe({
      next: r => {
        this.form = { ...r.data };
        this.success.set('Pricing config saved successfully.');
        this.saving.set(false);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: () => {
        this.error.set('Failed to save pricing config. Please try again.');
        this.saving.set(false);
      },
    });
  }

  /** Live preview of the price for a given distance using current form values. */
  preview(distanceKm: number): string {
    const { baseFare, baseRadiusKm, perExtraKmRate, serviceFeePercent, minimumFare } = this.form;
    let subtotal = distanceKm <= baseRadiusKm
      ? baseFare
      : baseFare + (distanceKm - baseRadiusKm) * perExtraKmRate;
    let total = subtotal + subtotal * serviceFeePercent / 100;
    total = Math.max(total, minimumFare);
    total = Math.round(total / 0.5) * 0.5;
    return `$${total.toFixed(2)}`;
  }
}
