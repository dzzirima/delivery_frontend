import { Component } from '@angular/core';

@Component({
  selector: 'app-delivery-bar-chart',
  imports: [],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 class="font-bold text-gray-900 mb-6">Deliveries This Week</h2>
      <div class="flex items-end gap-4 h-40">
        @for (bar of bars; track bar.day) {
          <div class="flex-1 flex flex-col items-center gap-1">
            <span class="text-xs font-semibold text-gray-500">{{ bar.val }}</span>
            <div
              class="w-full rounded-t-xl bg-[#4f46e5]"
              [style.height.%]="bar.pct"
              style="max-height:100%"
            ></div>
            <span class="text-xs text-gray-400">{{ bar.day }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class DeliveryBarChartComponent {
  bars = [
    { day: 'Mon', val: 28, pct: 56 },
    { day: 'Tue', val: 35, pct: 70 },
    { day: 'Wed', val: 50, pct: 100 },
    { day: 'Thu', val: 42, pct: 84 },
    { day: 'Fri', val: 38, pct: 76 },
    { day: 'Sat', val: 20, pct: 40 },
    { day: 'Sun', val: 10, pct: 20 },
  ];
}
