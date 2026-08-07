import { Component, computed, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, FormsModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  identifier = '';
  loading = signal(false);
  error = signal('');

  get isPhone(): boolean {
    const v = this.identifier.trim();
    return v.length > 0 && !v.includes('@');
  }

  constructor(private userService: UserService, private toast: ToastService, private router: Router) {}

  submit() {
    if (!this.identifier.trim()) {
      this.error.set('Please enter your email address or phone number.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.userService.forgotPassword(this.identifier.trim()).subscribe({
      next: () => {
        const dest = this.isPhone
          ? `Check your phone (${this.identifier.trim()}) for your reset code.`
          : `Check ${this.identifier.trim()} for your password reset code.`;
        this.toast.success('Reset code sent!', dest);
        this.router.navigate(['/reset-password'], { state: { isPhoneReset: this.isPhone } });
      },
      error: () => {
        this.error.set('Could not send reset code. Please check your email or phone number and try again.');
        this.loading.set(false);
      },
    });
  }
}
