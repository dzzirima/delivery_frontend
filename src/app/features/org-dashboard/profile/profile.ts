import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService, UpdateUserPayload } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-org-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.html',
})
export class Profile implements OnInit {

  saving = signal(false);

  form = {
    name:        '',
    email:       '',
    phoneNumber: '',
    address:     '',
  };

  get user() { return this.userService.profile; }

  constructor(
    private userService: UserService,
    private toast:       ToastService,
  ) {}

  ngOnInit() {
    const u = this.user();
    if (u) {
      this.form = {
        name:        u.name        ?? '',
        email:       u.email       ?? '',
        phoneNumber: u.phoneNumber ?? '',
        address:     u.address     ?? '',
      };
    }
  }

  save() {
    const u = this.user();
    if (!u) return;
    this.saving.set(true);
    const payload: UpdateUserPayload = {
      name:        this.form.name,
      phoneNumber: this.form.phoneNumber,
      address:     this.form.address,
    };
    this.userService.update(u.id, payload).subscribe({
      next:  () => { this.toast.success('Saved', 'Profile updated.'); this.saving.set(false); },
      error: e  => { this.toast.error('Error', e?.error?.message ?? 'Failed to save.'); this.saving.set(false); },
    });
  }
}
