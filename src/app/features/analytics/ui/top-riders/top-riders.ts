import { Component } from '@angular/core';

@Component({
  selector: 'app-top-riders',
  imports: [],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 class="font-bold text-gray-900 mb-4">Top Riders This Month</h2>
      <div class="space-y-3">
        @for (r of riders; track r.name; let i = $index) {
          <div class="flex items-center gap-3">
            <span class="text-xs font-bold text-gray-400 w-4">{{ i + 1 }}</span>
            <div class="flex-1">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-700 font-medium">{{ r.name }}</span>
                <span class="text-indigo-600 font-semibold">{{ r.count }}</span>
              </div>
              <div class="h-1.5 bg-gray-100 rounded-full">
                <div class="h-1.5 bg-[#4f46e5] rounded-full" [style.width.%]="(r.count / 61) * 100"></div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class TopRidersComponent {
  riders = [
    { name: 'Tendai Moyo',   count: 61 },
    { name: 'Farai Mutasa',  count: 55 },
    { name: 'Tapiwa Rusike', count: 42 },
    { name: 'Chidi Khumalo', count: 38 },
  ];
}
