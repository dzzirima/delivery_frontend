import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth.service';
import { ToastService } from '../../../core/toast.service';

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

  constructor(private router: Router, private authService: AuthService, private toast: ToastService) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  nextStep() {
    if (!this.adminName.trim()) {
      this.toast.warning('Missing field', 'Please enter your full name.');
      return;
    }
    if (!this.adminEmail.trim()) {
      this.toast.warning('Missing field', 'Please enter your email address.');
      return;
    }
    if (this.adminPassword.length < 6) {
      this.toast.warning('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    this.step.set(2);
  }

  back() {
    this.step.set(1);
  }

  register() {
    if (!this.orgName.trim()) {
      this.toast.warning('Missing field', 'Please enter your organisation name.');
      return;
    }
    if (!this.orgContactPhone.trim()) {
      this.toast.warning('Missing field', 'Please enter a contact phone number.');
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
      next: () => {
        this.toast.success('Account created!', 'Welcome to Thi. Your organisation is ready.');
        this.router.navigateByUrl('/org');
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Registration failed. Please try again.';
        this.toast.error('Registration failed', msg);
        this.loading.set(false);
      },
    });
  }
}
