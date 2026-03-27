import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../users/services/user.service';
import { ToastService } from '../../core/toast.service';
import { User, UserUpdatePayload } from '../users/models/user.model';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  user = signal<User | null>(null);

  form: UserUpdatePayload = { name: '', phoneNumber: '', address: '' };

  constructor(private userService: UserService, private toast: ToastService) {}

  ngOnInit() {
    this.userService.getProfile().subscribe({
      next: res => {
        this.user.set(res.data);
        this.form = {
          name: res.data.name ?? '',
          phoneNumber: res.data.phoneNumber ?? '',
          address: res.data.address ?? '',
        };
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load profile.');
        this.loading.set(false);
      },
    });
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    this.userService.updateProfile(this.form).subscribe({
      next: res => {
        this.user.set(res.data);
        this.toast.success('Profile updated!');
        this.saving.set(false);
      },
      error: () => {
        this.toast.error('Failed to update profile.');
        this.saving.set(false);
      },
    });
  }
}
