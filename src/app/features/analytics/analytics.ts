import { Component } from '@angular/core';
import { DeliveryBarChartComponent } from './ui/delivery-bar-chart/delivery-bar-chart';
import { StatusBreakdownComponent } from './ui/status-breakdown/status-breakdown';
import { TopRidersComponent } from './ui/top-riders/top-riders';

@Component({
  selector: 'app-analytics',
  imports: [DeliveryBarChartComponent, StatusBreakdownComponent, TopRidersComponent],
  templateUrl: './analytics.html',
})
export class Analytics {}
