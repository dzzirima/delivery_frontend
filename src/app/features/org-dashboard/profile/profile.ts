import { Component } from '@angular/core';
import { UserProfile } from '../../user-profile/user-profile';

@Component({
  selector: 'app-org-profile',
  standalone: true,
  imports: [UserProfile],
  template: `<app-user-profile />`
})
export class Profile {}
