import { Component } from '@angular/core';

@Component({
  selector: 'app-status-breakdown',
  imports: [],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 class="font-bold text-gray-900 mb-4">Delivery Status Breakdown</h2>
      <div class="space-y-3">
        @for (item of items; track item.label) {
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-gray-600">{{ item.label }}</span>
              <span class="font-semibold" [style.color]="item.color">{{ item.pct }}%</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full">
              <div class="h-2 rounded-full" [style.width.%]="item.pct" [style.background]="item.color"></div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class StatusBreakdownComponent {
  items = [
    { label: 'Delivered',   pct: 82, color: '#22c55e' },
    { label: 'In Transit',  pct: 12, color: '#6366f1' },
    { label: 'Pending',     pct: 5,  color: '#f97316' },
    { label: 'Failed',      pct: 1,  color: '#ef4444' },
  ];
}
