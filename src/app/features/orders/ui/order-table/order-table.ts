import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

type Filter = 'all' | 'pending' | 'transit' | 'delivered';

interface Order {
  id: string;
  customer: string;
  rider: string;
  status: 'Pending' | 'In Transit' | 'Delivered';
  date: string;
}

const ALL_ORDERS: Order[] = [
  { id: '#DG4f2a', customer: 'Sam Moyo',    rider: 'Tapiwa R.',  status: 'Delivered',  date: 'Mar 21, 2026' },
  { id: '#DG8b1c', customer: 'Tanya Mhuru', rider: 'Chidi K.',   status: 'In Transit', date: 'Mar 21, 2026' },
  { id: '#DGc3d9', customer: 'Chidi Obi',   rider: '—',          status: 'Pending',    date: 'Mar 21, 2026' },
  { id: '#DGa12b', customer: 'Grace Ncube', rider: 'Farai M.',   status: 'Delivered',  date: 'Mar 20, 2026' },
  { id: '#DGe99f', customer: 'Lena Dube',   rider: '—',          status: 'Pending',    date: 'Mar 20, 2026' },
];

const STATUS_MAP: Record<Filter, Order['status'] | null> = {
  all: null,
  pending: 'Pending',
  transit: 'In Transit',
  delivered: 'Delivered',
};

@Component({
  selector: 'app-order-table',
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
            <th class="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
            <th class="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rider</th>
            <th class="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th class="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          @for (order of filtered(); track order.id) {
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 font-medium text-gray-900">{{ order.id }}</td>
              <td class="px-6 py-4 text-gray-600">{{ order.customer }}</td>
              <td class="px-6 py-4 text-gray-600">{{ order.rider }}</td>
              <td class="px-6 py-4">
                <span [ngClass]="badge(order.status)" class="px-2.5 py-1 rounded-full text-xs font-semibold">
                  {{ order.status }}
                </span>
              </td>
              <td class="px-6 py-4 text-gray-500">{{ order.date }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class OrderTableComponent {
  filter = input.required<Filter>();

  filtered = computed(() => {
    const target = STATUS_MAP[this.filter()];
    return target ? ALL_ORDERS.filter(o => o.status === target) : ALL_ORDERS;
  });

  badge(status: Order['status']): string {
    return {
      'Delivered':  'bg-green-100 text-green-700',
      'In Transit': 'bg-indigo-100 text-indigo-700',
      'Pending':    'bg-orange-100 text-orange-600',
    }[status];
  }
}
