import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardService } from './services/dashboard.service';
import { DashboardSummary, DashboardAnalytics } from './models/dashboard.model';
import { UserService } from '../users/services/user.service';
import { User } from '../users/models/user.model';
import { GigService, GigStats } from '../gigs/services/gig.service';
import { IfRoleDirective } from '../../core/directives/if-role.directive';

const STATUS_COLORS: Record<string, string> = {
  APPLIED:    'bg-blue-100 text-blue-800',
  PENDING:    'bg-yellow-100 text-yellow-800',
  INTERVIEW:  'bg-purple-100 text-purple-800',
  ASSESSMENT: 'bg-orange-100 text-orange-800',
  REJECTED:   'bg-red-100 text-red-800',
  OFFER:      'bg-emerald-100 text-emerald-800',
  ON_HOLD:    'bg-slate-100 text-slate-700',
};

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, IfRoleDirective],
  templateUrl: './dashboard.html',
})
export class DashboardPage implements OnInit {
  private svc         = inject(DashboardService);
  private userService = inject(UserService);
  private gigService  = inject(GigService);

  summary      = signal<DashboardSummary | null>(null);
  analytics    = signal<DashboardAnalytics | null>(null);
  gigStats     = signal<GigStats | null>(null);
  agents       = signal<User[]>([]);
  loadingSummary   = signal(true);
  loadingAnalytics = signal(true);
  loadingGigStats  = signal(true);

  startDate = signal(this.firstOfMonth());
  endDate   = signal(this.today());
  agentId   = signal('');

  ngOnInit() {
    this.fetchSummary();
    this.fetchAnalytics();
    this.fetchGigStats();
    this.loadAgents();
  }

  loadAgents() {
    this.userService.getAll({ role: 'AGENT', size: 100 }).subscribe({
      next: r => this.agents.set(r.data?.content ?? []),
      error: () => {},
    });
  }

  fetchSummary() {
    this.loadingSummary.set(true);
    this.svc.getSummary().subscribe({
      next: r => { this.summary.set(r.data); this.loadingSummary.set(false); },
      error: () => this.loadingSummary.set(false),
    });
  }

  fetchGigStats() {
    this.loadingGigStats.set(true);
    this.gigService.getStats().subscribe({
      next: r => { this.gigStats.set(r.data); this.loadingGigStats.set(false); },
      error: () => this.loadingGigStats.set(false),
    });
  }

  fetchAnalytics() {
    this.loadingAnalytics.set(true);
    this.svc.getAnalytics({
      startDate: this.startDate(),
      endDate:   this.endDate(),
      agentId:   this.agentId() || undefined,
    }).subscribe({
      next: r => { this.analytics.set(r.data); this.loadingAnalytics.set(false); },
      error: () => this.loadingAnalytics.set(false),
    });
  }

  applyFilters() { this.fetchAnalytics(); }

  statusColor(s: string) { return STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700'; }

  maxCount(): number {
    const items = this.analytics()?.statusBreakdown ?? [];
    return items.length ? Math.max(...items.map(i => i.count), 1) : 1;
  }

  private firstOfMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  }
  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
}
