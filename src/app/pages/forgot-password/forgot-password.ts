import { Component, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../features/users/services/user.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, FormsModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  email = '';
  loading = signal(false);
  error = signal('');

  constructor(private userService: UserService, private toast: ToastService, private router: Router) {}

  submit() {
    if (!this.email) {
      this.error.set('Please enter your email address.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.userService.forgotPassword(this.email).subscribe({
      next: () => {
        this.toast.success('Reset code sent!', `Check ${this.email} for your password reset code.`);
        this.router.navigate(['/reset-password']);
      },
      error: () => {
        this.error.set('Could not send reset code. Please check the email and try again.');
        this.loading.set(false);
      },
    });
  }
}
