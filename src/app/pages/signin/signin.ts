import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { AuthService, UserProfile } from '../../core/auth.service';

@Component({
  selector: 'app-signin',
  imports: [RouterLink, FormsModule],
  templateUrl: './signin.html',
})
export class Signin {
  email = '';
  password = '';
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(private router: Router, private authService: AuthService) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  login() {
    if (!this.email || !this.password) {
      this.error.set('Please enter your email and password.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.authService
      .signin({ userName: this.email, password: this.password })
      .pipe(switchMap(() => this.authService.getProfile()))
      .subscribe({
        next: (res) => this.routeAfterLogin(res.data),
        error: (err) => {
          const msg = err?.error?.message || 'Invalid credentials. Please try again.';
          this.error.set(msg);
          this.loading.set(false);
        },
      });
  }

  private routeAfterLogin(profile: UserProfile) {
    const { role, orgId, organisationStatus } = profile;

    if (role === 'ORG_ADMIN') {
      if (!orgId) {
        this.router.navigate(['/setup-organization']);
        return;
      }
    }

    // All roles: check org status
    if (orgId && organisationStatus === 'ACTIVE') {
      this.router.navigate(['/app/dashboard']);
    } else {
      this.router.navigate(['/org-inactive']);
    }
  }
}
