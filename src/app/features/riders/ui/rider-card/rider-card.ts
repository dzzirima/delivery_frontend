import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Rider {
  name: string;
  zone: string;
  deliveries: number;
  status: 'Active' | 'Off duty';
  rating: number;
}

@Component({
  selector: 'app-rider-card',
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-11 h-11 rounded-full bg-[#131929] flex items-center justify-center text-white font-bold text-sm shrink-0">
          {{ rider().name.charAt(0) }}
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <p class="font-semibold text-gray-900 text-sm">{{ rider().name }}</p>
            <span
              [ngClass]="rider().status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
              class="text-xs px-2 py-0.5 rounded-full font-medium"
            >{{ rider().status }}</span>
          </div>
          <p class="text-xs text-gray-400">{{ rider().zone }}</p>
        </div>
      </div>
      <div class="flex items-center justify-between text-sm">
        <div>
          <p class="text-xs text-gray-400">Deliveries</p>
          <p class="font-bold text-indigo-600">{{ rider().deliveries }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-400">Rating</p>
          <p class="font-bold text-amber-500">⭐ {{ rider().rating }}</p>
        </div>
      </div>
    </div>
  `,
})
export class RiderCardComponent {
  rider = input.required<Rider>();
}
