import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  togglePassword() {
    this.showPassword.update(v => !v);
  }
}
