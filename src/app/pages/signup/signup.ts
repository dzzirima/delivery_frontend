import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-signup',
  imports: [RouterLink, FormsModule],
  templateUrl: './signup.html',
})
export class Signup {
  fullName = '';
  email = '';
  password = '';
  phone = '';
  address = '';
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(private router: Router, private authService: AuthService, private toast: ToastService) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  register() {
    if (!this.fullName || !this.email || !this.password || !this.phone || !this.address) {
      this.error.set('Please fill in all fields.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.authService.signup({
      name: this.fullName,
      email: this.email,
      password: this.password,
      phoneNumber: this.phone,
      address: this.address,
      status: 'ACTIVE',
      role: 'ADMIN',
    }).subscribe({
      next: () => {
        this.toast.success('Account created!', 'Welcome to TIH. Please sign in to continue.');
        setTimeout(() => this.router.navigate(['/signin']), 1500);
      },
      error: () => {
        this.error.set('Registration failed. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
