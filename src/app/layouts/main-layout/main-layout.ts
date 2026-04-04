import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { ApplicationService, ApplicationStats } from '../../features/applications/services/application.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
})
export class MainLayout implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private applicationService = inject(ApplicationService);

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  routeTitle = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.resolveTitle(this.router.url)),
    ),
    { initialValue: this.resolveTitle(this.router.url) },
  );

  appsOpen = signal(false);
  appStats = signal<ApplicationStats | null>(null);

  readonly appStatuses: { label: string; status: string; key: keyof ApplicationStats }[] = [
    { label: 'Applied',    status: 'APPLIED',    key: 'applied' },
    { label: 'Pending',    status: 'PENDING',    key: 'pending' },
    { label: 'Interview',  status: 'INTERVIEW',  key: 'interview' },
    { label: 'Assessment', status: 'ASSESSMENT', key: 'assessment' },
    { label: 'Rejected',   status: 'REJECTED',   key: 'rejected' },
    { label: 'Offer',      status: 'OFFER',      key: 'offer' },
    { label: 'On Hold',    status: 'ON_HOLD',    key: 'onHold' },
  ];

  ngOnInit() {
    if (this.router.url.includes('applications')) {
      this.appsOpen.set(true);
    }
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url.includes('applications')) {
          this.appsOpen.set(true);
        }
      });
    this.applicationService.getStats().subscribe({
      next: res => this.appStats.set(res.data),
    });
  }

  toggleApps() {
    this.appsOpen.update(v => !v);
  }

  statCount(key: keyof ApplicationStats): number {
    return this.appStats()?.[key] ?? 0;
  }

  isActiveStatus(status: string): boolean {
    const url = this.currentUrl();
    return url.includes('applications') && url.includes(`status=${status}`);
  }

  isAppsParentActive(): boolean {
    return this.currentUrl().includes('applications');
  }

  private resolveTitle(url: string): string {
    if (url.includes('dashboard')) return 'Dashboard';
    if (url.includes('applications')) return 'Applications';
    if (url.includes('calendar')) return 'Interview Calendar';
    if (url.match(/\/portfolio\/.+/)) return 'Portfolio Details';
    if (url.includes('portfolio')) return 'Portfolio';
    if (url.includes('gigs')) return 'Gigs';
    if (url.includes('payroll')) return 'Payroll';
    if (url.includes('analytics')) return 'Productivity Analytics';
    if (url.match(/\/users\/.+/)) return 'User Details';
    if (url.includes('users')) return 'Users';
    if (url.includes('organizations')) return 'Organisations';
    if (url.includes('settings')) return 'Settings';
    return 'GigMaster';
  }

  signOut() {
    this.authService.signOut();
  }
}
