import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { PlatformStats, SystemOverviewService } from './overview.service';

@Component({
  selector: 'app-system-overview',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './overview.html',
})
export class SystemOverview implements OnInit {

  stats   = signal<PlatformStats | null>(null);
  loading = signal(false);
  error   = signal('');

  readonly statCards = [
    { key: 'totalUsers',         label: 'Total Users',         icon: 'users',    colour: 'indigo' },
    { key: 'totalRiders',        label: 'Riders',              icon: 'bike',     colour: 'violet' },
    { key: 'totalOrganisations', label: 'Organisations',       icon: 'building', colour: 'sky'    },
    { key: 'totalDeliveries',    label: 'Total Deliveries',    icon: 'bolt',     colour: 'emerald'},
    { key: 'pendingDriverKyc',   label: 'Pending Driver KYC',  icon: 'shield',   colour: 'amber'  },
    { key: 'pendingBikeKyc',     label: 'Pending Bike KYC',    icon: 'shield',   colour: 'orange' },
  ];

  constructor(private overviewService: SystemOverviewService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.overviewService.getStats().subscribe({
      next:  r => { this.stats.set(r.data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load platform stats.'); this.loading.set(false); },
    });
  }

  statValue(key: string): number {
    const s = this.stats();
    return s ? (s as unknown as Record<string, number>)[key] ?? 0 : 0;
  }
}
