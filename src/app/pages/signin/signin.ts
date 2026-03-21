import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

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
    this.authService.signin({ userName: this.email, password: this.password }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error.set('Invalid credentials. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
