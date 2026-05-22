import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-signup',
  imports: [RouterLink, FormsModule],
  templateUrl: './signup.html',
})
export class Signup {
  // ── Step ──────────────────────────────────────────────────────────────────
  step = signal<1 | 2>(1);

  // ── Step 1 — admin account ────────────────────────────────────────────────
  adminName     = '';
  adminEmail    = '';
  adminPassword = '';
  showPassword  = signal(false);

  // ── Step 2 — organisation ─────────────────────────────────────────────────
  orgName                  = '';
  orgContactPhone          = '';
  orgContactEmail          = '';
  businessRegistrationNumber = '';

  // ── State ─────────────────────────────────────────────────────────────────
  loading = signal(false);
  error   = signal('');

  constructor(private router: Router, private authService: AuthService) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  nextStep() {
    this.error.set('');
    if (!this.adminName.trim()) {
      this.error.set('Please enter your full name.');
      return;
    }
    if (!this.adminEmail.trim()) {
      this.error.set('Please enter your email address.');
      return;
    }
    if (this.adminPassword.length < 6) {
      this.error.set('Password must be at least 6 characters.');
      return;
    }
    this.step.set(2);
  }

  back() {
    this.error.set('');
    this.step.set(1);
  }

  register() {
    this.error.set('');
    if (!this.orgName.trim()) {
      this.error.set('Please enter your organisation name.');
      return;
    }
    if (!this.orgContactPhone.trim()) {
      this.error.set('Please enter a contact phone number.');
      return;
    }

    this.loading.set(true);

    const payload = {
      adminName:     this.adminName.trim(),
      adminEmail:    this.adminEmail.trim(),
      adminPassword: this.adminPassword,
      orgName:       this.orgName.trim(),
      orgContactPhone: this.orgContactPhone.trim(),
      ...(this.orgContactEmail.trim()           && { orgContactEmail: this.orgContactEmail.trim() }),
      ...(this.businessRegistrationNumber.trim() && { businessRegistrationNumber: this.businessRegistrationNumber.trim() }),
    };

    this.authService.orgRegister(payload).subscribe({
      next: () => this.router.navigateByUrl('/org'),
      error: (err) => {
        const msg = err?.error?.message ?? 'Registration failed. Please try again.';
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }
}
