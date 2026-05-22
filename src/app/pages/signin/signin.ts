import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

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
  error        = signal('');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {
    // Show message when redirected here after a 401 (e.g. stale/deleted account)
    const nav = this.router.getCurrentNavigation();
    const authError = nav?.extras?.state?.['authError'];
    if (authError) this.error.set(authError);
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  /** Returns true if the identifier looks like a phone number */
  private isPhone(value: string): boolean {
    return /^\+?[\d\s\-()]{7,}$/.test(value.trim());
  }

  login() {
    if (!this.identifier || !this.password) {
      this.error.set('Please enter your email or phone number and password.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const payload = this.isPhone(this.identifier)
      ? { phoneNumber: this.identifier.trim(), pin: this.password }
      : { userName:    this.identifier.trim(), password: this.password };

    this.authService.signin(payload).subscribe({
      next:  () => this.handleSuccess(),
      error: () => {
        this.error.set('Invalid credentials. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private handleSuccess(): void {
    const home = this.authService.resolveHomeRoute();

    if (!home) {
      this.authService.signOut();
      this.error.set('This portal is for operators only. Please use the TIH mobile app.');
      this.loading.set(false);
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const target    = returnUrl && returnUrl.startsWith(home) ? returnUrl : home;
    this.router.navigateByUrl(target);
  }
}
