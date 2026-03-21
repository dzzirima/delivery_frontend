import { Component, input } from '@angular/core';

export interface Customer {
  name: string;
  email: string;
  orders: number;
  joined: string;
}

@Component({
  selector: 'app-customer-card',
  imports: [],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
          {{ customer().name.charAt(0) }}
        </div>
        <div>
          <p class="font-semibold text-gray-900 text-sm">{{ customer().name }}</p>
          <p class="text-xs text-gray-400">{{ customer().email }}</p>
        </div>
      </div>
      <div class="flex items-center justify-between text-sm">
        <div>
          <p class="text-xs text-gray-400">Total orders</p>
          <p class="font-bold text-indigo-600">{{ customer().orders }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-400">Joined</p>
          <p class="font-medium text-gray-700">{{ customer().joined }}</p>
        </div>
      </div>
    </div>
  `,
})
export class CustomerCardComponent {
  customer = input.required<Customer>();
}
