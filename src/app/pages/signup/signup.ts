import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

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

  togglePassword() {
    this.showPassword.update(v => !v);
  }
}
