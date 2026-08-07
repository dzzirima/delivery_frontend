import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-signin',
  imports: [RouterLink, FormsModule],
  templateUrl: './signin.html',
})
export class Signin {
  identifier   = '';   // email OR phone number
  password     = '';
  showPassword = signal(false);
  loading      = signal(false);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toast: ToastService,
  ) {
    // Show message when redirected here after a 401 (e.g. stale/deleted account)
    const nav = this.router.getCurrentNavigation();
    const authError = nav?.extras?.state?.['authError'];
    if (authError) this.toast.error('Session expired', authError);
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  login() {
    if (!this.identifier || !this.password) {
      this.toast.warning('Missing fields', 'Please enter your email or phone number and password.');
      return;
    }

    this.loading.set(true);

    this.authService.signin({ identifier: this.identifier.trim(), password: this.password }).subscribe({
      next:  () => this.handleSuccess(),
      error: () => {
        this.toast.error('Sign in failed', 'Invalid credentials. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private handleSuccess(): void {
    const home = this.authService.resolveHomeRoute();

    if (!home) {
      this.authService.signOut();
      this.toast.error('Access denied', 'This portal is for operators only. Please use the TIH mobile app.');
      this.loading.set(false);
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const target    = returnUrl && returnUrl.startsWith(home) ? returnUrl : home;
    this.router.navigateByUrl(target);
  }
}
