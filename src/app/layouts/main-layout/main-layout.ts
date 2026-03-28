import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private authService = inject(AuthService);
  private router = inject(Router);

  private routeTitle$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(() => this.resolveTitle(this.router.url)),
  );
  routeTitle = toSignal(this.routeTitle$, {
    initialValue: this.resolveTitle(this.router.url),
  });

  private resolveTitle(url: string): string {
    if (url.includes('dashboard')) return 'Dashboard';
    if (url.includes('applications')) return 'Applications';
    if (url.includes('calendar')) return 'Interview Calendar';
    if (url.includes('portfolio')) return 'Portfolio';
    if (url.includes('analytics')) return 'Productivity Analytics';
    if (url.includes('users')) return 'Users';
    if (url.includes('organizations')) return 'Organisations';
    if (url.includes('settings')) return 'Settings';
    return 'GigMaster';
  }

  signOut() {
    this.authService.signOut();
  }
}
