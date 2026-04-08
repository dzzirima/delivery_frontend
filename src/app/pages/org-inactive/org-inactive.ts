import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-org-inactive',
  templateUrl: './org-inactive.html',
})
export class OrgInactive {
  constructor(private authService: AuthService) {}

  signOut() {
    this.authService.signOut();
  }
}
