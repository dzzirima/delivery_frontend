import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PortfolioService } from '../services/portfolio.service';
import { GigService } from '../../gigs/services/gig.service';
import { Portfolio } from '../models/portfolio.model';
import { Gig } from '../../gigs/models/gig.model';

@Component({
  selector: 'app-portfolio-detail',
  imports: [RouterLink],
  templateUrl: './portfolio-detail.html',
})
export class PortfolioDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private portfolioService = inject(PortfolioService);
  private gigService = inject(GigService);

  portfolio = signal<Portfolio | null>(null);
  liveGigs = signal<Gig[]>([]);
  loading = signal(true);
  error = signal('');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    forkJoin({
      portfolio: this.portfolioService.getById(id),
      gigs: this.gigService.getLiveByPortfolioId(id),
    }).subscribe({
      next: ({ portfolio, gigs }) => {
        this.portfolio.set(portfolio.data);
        this.liveGigs.set(Array.isArray(gigs.data) ? gigs.data : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load portfolio details.');
        this.loading.set(false);
      },
    });
  }

  back() {
    this.router.navigate(['/app/portfolio']);
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE:    'bg-green-100 text-green-700',
      SUSPENDED: 'bg-amber-100 text-amber-700',
      ARCHIVED:  'bg-gray-100 text-gray-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  viewGig(id: string) {
    this.router.navigate(['/app/gigs', id]);
  }
}
