import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from './services/user.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { User, USER_ROLES, USER_STATUSES, UserRole, UserStatus } from './models/user.model';

interface AddAgentForm {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
}

@Component({
  selector: 'app-users',
  imports: [FormsModule],
  templateUrl: './users.html',
})
export class UsersPage implements OnInit {
  readonly roles = USER_ROLES;
  readonly statuses = USER_STATUSES;

  users = signal<User[]>([]);
  loading = signal(false);
  error = signal('');
  totalElements = signal(0);

  filterRole = signal<UserRole | ''>('');
  filterStatus = signal<UserStatus | ''>('');
  searchQuery = '';

  showPasswordModal = signal(false);
  selectedUserId = signal('');
  newPassword = '';
  settingPassword = signal(false);

  get isOrgAdmin(): boolean {
    return this.authService.getRole() === 'ORG_ADMIN';
  }

  showAddAgentModal = signal(false);
  addingAgent = signal(false);
  addAgentForm: AddAgentForm = this.emptyAgentForm();
  showAgentPassword = signal(false);
  agentPasswordType = signal<'password' | 'text'>('password');

  constructor(
    private userService: UserService,
    private toast: ToastService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.userService.getAll({
      role: this.filterRole() || undefined,
      status: this.filterStatus() || undefined,
      search: this.searchQuery || undefined,
      page: 0,
      size: 20,
    }).subscribe({
      next: res => {
        this.users.set(res.data?.content ?? []);
        this.totalElements.set(res.data?.totalElements ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load users.');
        this.loading.set(false);
      },
    });
  }

  onFilterChange() {
    this.load();
  }

  deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    this.userService.delete(id).subscribe({
      next: () => {
        this.toast.success('User deleted.');
        this.users.update(list => list.filter(u => u.id !== id));
        this.totalElements.update(n => n - 1);
      },
      error: () => this.toast.error('Failed to delete user.'),
    });
  }

  openSetPassword(userId: string) {
    this.selectedUserId.set(userId);
    this.newPassword = '';
    this.showPasswordModal.set(true);
  }

  closePasswordModal() {
    this.showPasswordModal.set(false);
    this.selectedUserId.set('');
    this.newPassword = '';
  }

  setPassword() {
    if (!this.newPassword.trim()) return;
    this.settingPassword.set(true);
    this.userService.adminSetPassword({ userId: this.selectedUserId(), newPassword: this.newPassword }).subscribe({
      next: () => {
        this.toast.success('Password updated!');
        this.closePasswordModal();
        this.settingPassword.set(false);
      },
      error: () => {
        this.toast.error('Failed to set password.');
        this.settingPassword.set(false);
      },
    });
  }

  openAddAgent() {
    this.addAgentForm = this.emptyAgentForm();
    this.agentPasswordType.set('password');
    this.showAddAgentModal.set(true);
  }

  closeAddAgentModal() {
    this.showAddAgentModal.set(false);
  }

  toggleAgentPasswordVisibility() {
    this.agentPasswordType.set(this.agentPasswordType() === 'password' ? 'text' : 'password');
  }

  generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.addAgentForm.password = pwd;
    this.agentPasswordType.set('text');
  }

  addAgent() {
    const f = this.addAgentForm;
    if (!f.name.trim() || !f.email.trim() || !f.password.trim()) return;
    this.addingAgent.set(true);
    this.userService.addUserToOrg({
      name: f.name,
      email: f.email,
      password: f.password,
      phoneNumber: f.phoneNumber,
      address: f.address,
      role: 'AGENT',
      status: 'ACTIVE',
    }).subscribe({
      next: () => {
        this.toast.success('Agent added successfully!');
        this.closeAddAgentModal();
        this.addingAgent.set(false);
        this.load();
      },
      error: () => {
        this.toast.error('Failed to add agent.');
        this.addingAgent.set(false);
      },
    });
  }

  private emptyAgentForm(): AddAgentForm {
    return { name: '', email: '', password: '', phoneNumber: '', address: '' };
  }

  roleClass(role: UserRole): string {
    const map: Record<string, string> = {
      SYSTEM_ADMIN: 'bg-red-100 text-red-700',
      ORG_ADMIN:    'bg-indigo-100 text-indigo-700',
      AGENT:        'bg-blue-100 text-blue-700',
      ADMIN:        'bg-purple-100 text-purple-700',
      CUSTOMER:     'bg-teal-100 text-teal-700',
      RIDER:        'bg-amber-100 text-amber-700',
    };
    return map[role] ?? 'bg-gray-100 text-gray-600';
  }

  statusClass(status: UserStatus): string {
    const map: Record<UserStatus, string> = {
      ACTIVE:    'bg-green-100 text-green-700',
      INACTIVE:  'bg-gray-100 text-gray-500',
      SUSPENDED: 'bg-red-100 text-red-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }
}
