import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';

@Component({
  selector: 'app-system-admin',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './system-admin.html',
})
export class SystemAdmin {
  collapsed = signal(false);

  readonly navItems = [
    { id: 'overview',       route: 'overview',       label: 'Overview',       icon: 'home'     },
    { id: 'kyc',            route: 'kyc',            label: 'KYC Review',     icon: 'shield'   },
    { id: 'riders',         route: 'riders',         label: 'Riders',         icon: 'bike'     },
    { id: 'organisations',  route: 'organisations',  label: 'Organisations',  icon: 'building' },
    { id: 'users',          route: 'users',          label: 'Users',          icon: 'users'    },
  ];

  initials = computed(() => {
    const name = this.userService.profile()?.name ?? '';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'SA';
  });

  get currentUser() { return this.userService.profile; }

  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  toggleCollapsed() { this.collapsed.update(v => !v); }

  signOut() { this.authService.signOut(); }
}
