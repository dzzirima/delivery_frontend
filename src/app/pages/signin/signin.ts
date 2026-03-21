import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-signin',
  imports: [RouterLink, FormsModule],
  templateUrl: './signin.html',
})
export class Signin {
  email = '';
  password = '';
  showPassword = signal(false);

  constructor(private router: Router) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  login() {
    this.router.navigate(['/dashboard']);
  }
}
