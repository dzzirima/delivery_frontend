import { Component, OnInit, Output, EventEmitter, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService, UpdateUserPayload } from '../users/services/user.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-user-profile',
  imports: [FormsModule],
  templateUrl: './user-profile.html',
})
export class UserProfile implements OnInit {
  @Output() navigateTo = new EventEmitter<string>();

  get user() { return this.userService.profile; }
  loading = signal(true);
  editing = signal(false);
  saving = signal(false);
  error = signal('');

  form: UpdateUserPayload = { name: '', email: '', phoneNumber: '', address: '' };

  initials = computed(() => {
    const name = this.userService.profile()?.name ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  });

  constructor(private userService: UserService, private toast: ToastService) {}

  ngOnInit() {
    this.userService.getMyProfile().subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.error.set('Failed to load profile.');
        this.loading.set(false);
      },
    });
  }

  startEdit() {
    const u = this.user();
    if (!u) return;
    this.form = { name: u.name, email: u.email, phoneNumber: u.phoneNumber, address: u.address };
    this.editing.set(true);
  }

  cancelEdit() {
    this.editing.set(false);
  }

  save() {
    const u = this.user();
    if (!u) return;
    this.saving.set(true);
    this.userService.update(u.id, this.form).subscribe({
      next: () => {
        this.userService.getMyProfile().subscribe({
          next: () => {
            this.saving.set(false);
            this.toast.success('Profile updated!', 'Your changes have been saved.');
            this.navigateTo.emit('dashboard');
          },
          error: () => {
            this.saving.set(false);
            this.navigateTo.emit('dashboard');
          },
        });
      },
      error: () => {
        this.toast.error('Update failed', 'Could not save your changes. Please try again.');
        this.saving.set(false);
      },
    });
  }
}
