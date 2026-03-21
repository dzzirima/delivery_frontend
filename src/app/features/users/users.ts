import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService, User } from './services/user.service';

@Component({
  selector: 'app-users',
  imports: [FormsModule],
  templateUrl: './users.html',
})
export class Users implements OnInit {
  users = signal<User[]>([]);
  loading = signal(false);
  error = signal('');
  search = '';

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.error.set('');
    this.userService.getAll({ search: this.search || undefined }).subscribe({
      next: res => {
        this.users.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load users.');
        this.loading.set(false);
      },
    });
  }

  deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    this.userService.delete(id).subscribe({
      next: () => this.users.update(list => list.filter(u => u.id !== id)),
      error: () => this.error.set('Failed to delete user.'),
    });
  }
}
