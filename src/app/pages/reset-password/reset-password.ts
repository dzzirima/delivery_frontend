import { Component, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../features/users/services/user.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, FormsModule],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  code = '';
  newPassword = '';
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(private userService: UserService, private toast: ToastService, private router: Router) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  submit() {
    if (!this.code || !this.newPassword) {
      this.error.set('Please enter the reset code and your new password.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.userService.resetPassword(this.code, this.newPassword).subscribe({
      next: () => {
        this.toast.success('Password reset!', 'Your password has been updated. Please sign in.');
        setTimeout(() => this.router.navigate(['/signin']), 1500);
      },
      error: () => {
        this.error.set('Invalid or expired reset code. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
