import { Component, input, output } from '@angular/core';

type Filter = 'all' | 'pending' | 'transit' | 'delivered';

@Component({
  selector: 'app-order-filters',
  imports: [],
  template: `
    <div class="flex gap-2 mb-4">
      @for (f of filters; track f.id) {
        <button
          (click)="filterChange.emit(f.id)"
          [class.bg-[#4f46e5]]="active() === f.id"
          [class.text-white]="active() === f.id"
          [class.bg-white]="active() !== f.id"
          [class.text-gray-600]="active() !== f.id"
          class="px-4 py-2 rounded-xl text-sm font-semibold border border-transparent hover:border-indigo-200 transition-colors"
        >{{ f.label }}</button>
      }
    </div>
  `,
})
export class OrderFiltersComponent {
  active = input.required<Filter>();
  filterChange = output<Filter>();

  filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'transit', label: 'In Transit' },
    { id: 'delivered', label: 'Delivered' },
  ];
}
