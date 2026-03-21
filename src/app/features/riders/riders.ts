import { Component } from '@angular/core';
import { RiderCardComponent, Rider } from './ui/rider-card/rider-card';

@Component({
  selector: 'app-riders',
  imports: [RiderCardComponent],
  templateUrl: './riders.html',
})
export class Riders {
  riders: Rider[] = [
    { name: 'Tapiwa Rusike', zone: 'Borrowdale',  deliveries: 42, status: 'Active',   rating: 4.9 },
    { name: 'Chidi Khumalo', zone: 'Avondale',    deliveries: 38, status: 'Active',   rating: 4.7 },
    { name: 'Farai Mutasa',  zone: 'Highlands',   deliveries: 55, status: 'Active',   rating: 4.8 },
    { name: 'Rudo Zimba',    zone: 'Hatfield',    deliveries: 29, status: 'Off duty', rating: 4.6 },
    { name: 'Tendai Moyo',   zone: 'Marlborough', deliveries: 61, status: 'Active',   rating: 4.9 },
  ];
}
