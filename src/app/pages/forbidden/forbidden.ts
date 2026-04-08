import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-forbidden',
  templateUrl: './forbidden.html',
})
export class Forbidden {
  private router = inject(Router);
  private auth   = inject(AuthService);

  goBack()    { this.router.navigate(['/app/dashboard']); }
  signOut()   { this.auth.signOut(); }
}
