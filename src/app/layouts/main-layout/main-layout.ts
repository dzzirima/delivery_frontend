import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { IfRoleDirective } from '../../core/directives/if-role.directive';
import { ApplicationService, ApplicationStats } from '../../features/applications/services/application.service';
import { NAV_ITEMS, NavItem, NavChild } from '../../core/nav.config';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IfRoleDirective],
  templateUrl: './main-layout.html',
})
export class MainLayout implements OnInit {
  private authService        = inject(AuthService);
  private router             = inject(Router);
  private applicationService = inject(ApplicationService);

  // ── URL tracking ────────────────────────────────────────────────────────────
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

  // ── Stats ────────────────────────────────────────────────────────────────────
  appStats = signal<ApplicationStats | null>(null);

  // ── Group open/close state keyed by NavItem id ──────────────────────────────
  openGroups = signal<Record<string, boolean>>({});

  // ── RBAC: filter nav items by the current user's role ───────────────────────
  visibleNavItems = computed(() => {
    const role = this.authService.role();
    return NAV_ITEMS.filter(item =>
      item.roles.length === 0 || (role != null && item.roles.includes(role)),
    );
  });

  // ── Expose admin roles for *ifRole in template ───────────────────────────────
  readonly ADMIN_ROLES = ['ORG_ADMIN', 'SYSTEM_ADMIN'];

  ngOnInit() {
    // Open groups whose children match the current URL
    this.syncOpenGroups(this.router.url);

    // Keep groups open as the user navigates
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.syncOpenGroups(this.router.url));

    this.applicationService.getStats().subscribe({
      next: res => this.appStats.set(res.data),
    });
  }

  // ── Group helpers ────────────────────────────────────────────────────────────
  toggleGroup(id: string) {
    this.openGroups.update(s => ({ ...s, [id]: !s[id] }));
  }

  isGroupOpen(id: string): boolean {
    return this.openGroups()[id] ?? false;
  }

  isGroupParentActive(item: NavItem): boolean {
    const url = this.currentUrl();
    return item.children?.some(c => url.startsWith(c.route)) ?? false;
  }

  // ── Child helpers ─────────────────────────────────────────────────────────────
  isChildActive(child: NavChild): boolean {
    const url = this.currentUrl();
    if (!child.queryParams) {
      return url === child.route || url.startsWith(child.route + '/');
    }
    return (
      url.includes(child.route) &&
      Object.entries(child.queryParams).every(([k, v]) => url.includes(`${k}=${v}`))
    );
  }

  childCount(statsKey?: string): number {
    if (!statsKey) return 0;
    return this.appStats()?.[statsKey as keyof ApplicationStats] ?? 0;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  signOut() {
    this.authService.signOut();
  }

  // ── Privates ─────────────────────────────────────────────────────────────────
  private syncOpenGroups(url: string) {
    this.openGroups.update(current => {
      const updated = { ...current };
      NAV_ITEMS.forEach(item => {
        if (item.type === 'group' && item.children?.some(c => url.startsWith(c.route))) {
          updated[item.id] = true;
        }
      });
      return updated;
    });
  }

  private resolveTitle(url: string): string {
    if (url.includes('dashboard'))         return 'Dashboard';
    if (url.includes('applications'))      return 'Applications';
    if (url.includes('calendar'))          return 'Interview Calendar';
    if (url.match(/\/portfolio\/.+/))      return 'Portfolio Details';
    if (url.includes('portfolio'))         return 'Portfolio';
    if (url.includes('gigs'))              return 'Gigs';
    if (url.match(/\/payroll-bills\/.+/))  return 'Bill Detail';
    if (url.includes('payroll-bills'))     return 'Payroll Bills';
    if (url.includes('/payslips'))         return 'My Payslips';
    if (url.includes('payroll'))           return 'Payroll';
    if (url.includes('analytics'))         return 'Productivity Analytics';
    if (url.match(/\/users\/.+/))          return 'User Details';
    if (url.includes('users'))             return 'Users';
    if (url.includes('organizations'))     return 'Organisations';
    if (url.includes('settings'))          return 'Settings';
    return 'GigMaster';
  }
}
