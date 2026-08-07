import { Component, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, FormsModule],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  code = '';
  secret = '';
  isPhoneReset = false;
  showSecret = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(private userService: UserService, private toast: ToastService, private router: Router) {
    // Router state is set by forgot-password when navigating here.
    // Falls back to false (email/password reset) if navigated to directly.
    this.isPhoneReset = !!(history.state as { isPhoneReset?: boolean })?.isPhoneReset;
  }

  toggleSecret() {
    this.showSecret.update(v => !v);
  }

  submit() {
    if (!this.code.trim()) {
      this.error.set('Please enter the reset code.');
      return;
    }
    if (!this.secret) {
      this.error.set(this.isPhoneReset ? 'Please enter your new PIN.' : 'Please enter your new password.');
      return;
    }
    if (this.isPhoneReset && this.secret.length !== 4) {
      this.error.set('PIN must be exactly 4 digits.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.userService.resetPassword(this.code.trim(), this.secret).subscribe({
      next: () => {
        const msg = this.isPhoneReset ? 'Your PIN has been updated. Please sign in.' : 'Your password has been updated. Please sign in.';
        this.toast.success(this.isPhoneReset ? 'PIN reset!' : 'Password reset!', msg);
        setTimeout(() => this.router.navigate(['/signin']), 1500);
      },
      error: () => {
        this.error.set('Invalid or expired reset code. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
