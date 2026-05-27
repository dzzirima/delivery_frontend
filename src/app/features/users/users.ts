import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService, User } from './services/user.service';
import { UserEdit } from './ui/user-edit/user-edit';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-users',
  imports: [FormsModule, UserEdit],
  templateUrl: './users.html',
})
export class Users implements OnInit {
  users = signal<User[]>([]);
  loading = signal(false);
  search = '';
  totalElements = signal(0);
  page = signal(0);
  pageSize = signal(20);
  readonly pageSizeOptions = [10, 20, 50, 100];
  totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()));
  pages = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const pages: number[] = [];
    pages.push(0);
    if (current > 2) pages.push(-1);
    for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) pages.push(i);
    if (current < total - 3) pages.push(-1);
    pages.push(total - 1);
    return pages;
  });
  selectedUserId = signal<string | null>(null);

  constructor(private userService: UserService, private toast: ToastService) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers(page = 0) {
    this.loading.set(true);
    this.page.set(page);
    this.userService.getAll({ search: this.search || undefined, page, size: this.pageSize() }).subscribe({
      next: res => {
        this.users.set(Array.isArray(res.data) ? res.data : (res.data?.content ?? []));
        this.totalElements.set(res.data?.totalElements ?? this.users().length);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Load failed', 'Failed to load users.');
        this.loading.set(false);
      },
    });
  }

  changePageSize(size: number) {
    this.pageSize.set(size);
    this.loadUsers(0);
  }

  selectUser(id: string) {
    this.selectedUserId.set(id);
  }

  onEditDone() {
    this.selectedUserId.set(null);
    this.loadUsers(this.page());
  }

  deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    this.userService.delete(id).subscribe({
      next: () => {
        this.users.update(list => list.filter(u => u.id !== id));
        this.toast.success('User deleted', 'The user has been removed.');
      },
      error: () => this.toast.error('Delete failed', 'Could not delete the user. Please try again.'),
    });
  }
}
