import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Gig } from '../models/gig.model';
import { GigService, GigStats } from '../services/gig.service';

@Component({
  selector: 'app-gigs-list',
  imports: [],
  templateUrl: './gigs-list.html',
})
export class GigsList implements OnInit {
  gigs = signal<Gig[]>([]);
  stats = signal<GigStats>({ liveCount: 0, droppedCount: 0, totalCount: 0 });
  loading = signal(true);

  constructor(private gigService: GigService, private router: Router) {}

  ngOnInit() {
    this.gigService.getStats().subscribe({
      next: res => this.stats.set(res.data),
      error: () => {},
    });

    this.gigService.getAll().subscribe({
      next: res => {
        this.gigs.set(Array.isArray(res.data) ? res.data : []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openGig(id: string) {
    this.router.navigate(['/app/gigs', id]);
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
