import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService, User, UpdateUserPayload } from '../../services/user.service';
import { ToastService } from '../../../../core/toast.service';

@Component({
  selector: 'app-user-edit',
  imports: [FormsModule],
  templateUrl: './user-edit.html',
})
export class UserEdit implements OnInit {
  @Input({ required: true }) userId!: string;
  @Output() done = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  user = signal<User | null>(null);
  loading = signal(true);
  editing = signal(false);
  saving = signal(false);
  error = signal('');

  form: UpdateUserPayload = { name: '', email: '', phoneNumber: '', address: '' };

  initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  });

  constructor(private userService: UserService, private toast: ToastService) {}

  ngOnInit() {
    this.userService.getById(this.userId).subscribe({
      next: res => {
        this.user.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load user.');
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
      next: res => {
        this.user.set(res.data ?? { ...u, ...this.form } as User);
        this.editing.set(false);
        this.saving.set(false);
        this.toast.success('User updated!', 'Changes have been saved.');
        this.done.emit();
      },
      error: () => {
        this.toast.error('Update failed', 'Could not save changes. Please try again.');
        this.saving.set(false);
      },
    });
  }
}
