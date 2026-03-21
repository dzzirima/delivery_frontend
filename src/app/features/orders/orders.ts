import { Component, signal } from '@angular/core';
import { OrderTableComponent } from './ui/order-table/order-table';
import { OrderFiltersComponent } from './ui/order-filters/order-filters';

@Component({
  selector: 'app-orders',
  imports: [OrderTableComponent, OrderFiltersComponent],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders {
  activeFilter = signal<'all' | 'pending' | 'transit' | 'delivered'>('all');

}
