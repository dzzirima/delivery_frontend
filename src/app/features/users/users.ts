import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserService } from './services/user.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { User, USER_ROLES, USER_STATUSES, UserRole, UserStatus } from './models/user.model';
import { ContractService } from '../contracts/services/contract.service';
import { ContractStatus, DEPARTMENTS } from '../contracts/models/contract.model';

interface AddUserForm {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
  nationalId: string;
  dateOfBirth: string;
  role: UserRole;
}

interface EditUserForm {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  status: UserStatus;
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

  // Map of userId → contract status for the list column
  contractStatusMap = signal<Map<string, ContractStatus>>(new Map());

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

  showEditModal  = signal(false);
  editForm       = signal<EditUserForm | null>(null);
  savingEdit     = signal(false);

  showAddUserModal = signal(false);
  addingUser = signal(false);
  addUserForm: AddUserForm = this.emptyUserForm();
  userPasswordType = signal<'password' | 'text'>('password');

  constructor(
    private userService: UserService,
    private contractService: ContractService,
    private toast: ToastService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    forkJoin([
      this.userService.getAll({
        role: this.filterRole() || undefined,
        status: this.filterStatus() || undefined,
        search: this.searchQuery || undefined,
        page: 0,
        size: 100,
      }),
      this.contractService.getAll(),
    ]).subscribe({
      next: ([usersRes, contractsRes]) => {
        this.users.set(usersRes.data?.content ?? []);
        this.totalElements.set(usersRes.data?.totalElements ?? 0);

        const map = new Map<string, ContractStatus>();
        for (const c of contractsRes.data ?? []) {
          map.set(c.userId, c.status);
        }
        this.contractStatusMap.set(map);
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

  viewUser(id: string) {
    this.router.navigate(['/app/users', id]);
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

  openAddUser() {
    this.addUserForm = this.emptyUserForm();
    this.userPasswordType.set('password');
    this.showAddUserModal.set(true);
  }

  closeAddUserModal() {
    this.showAddUserModal.set(false);
  }

  toggleUserPasswordVisibility() {
    this.userPasswordType.set(this.userPasswordType() === 'password' ? 'text' : 'password');
  }

  generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.addUserForm.password = pwd;
    this.userPasswordType.set('text');
  }

  addUser() {
    const f = this.addUserForm;
    if (!f.name.trim() || !f.email.trim() || !f.password.trim()) return;
    this.addingUser.set(true);
    this.userService.addUserToOrg({
      name: f.name,
      email: f.email,
      password: f.password,
      phoneNumber: f.phoneNumber,
      address: f.address,
      nationalId: f.nationalId || undefined,
      dateOfBirth: f.dateOfBirth || undefined,
      role: f.role,
      status: 'ACTIVE',
    }).subscribe({
      next: () => {
        this.toast.success('User added successfully!');
        this.closeAddUserModal();
        this.addingUser.set(false);
        this.load();
      },
      error: () => {
        this.toast.error('Failed to add user.');
        this.addingUser.set(false);
      },
    });
  }

  openEditUser(u: User) {
    this.editForm.set({ id: u.id, name: u.name, email: u.email, phoneNumber: u.phoneNumber ?? '', address: u.address ?? '', status: u.status });
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editForm.set(null);
  }

  setEditField(field: keyof EditUserForm, value: string) {
    const f = this.editForm();
    if (f) this.editForm.set({ ...f, [field]: value });
  }

  setEditStatus(status: UserStatus) {
    const f = this.editForm();
    if (f) this.editForm.set({ ...f, status });
  }

  saveEdit() {
    const f = this.editForm();
    if (!f) return;
    this.savingEdit.set(true);
    this.userService.update(f.id, { name: f.name, email: f.email, phoneNumber: f.phoneNumber, address: f.address, status: f.status }).subscribe({
      next: res => {
        this.users.update(list => list.map(u => u.id === f.id ? res.data : u));
        this.toast.success('User updated.');
        this.closeEditModal();
        this.savingEdit.set(false);
      },
      error: () => {
        this.toast.error('Failed to update user.');
        this.savingEdit.set(false);
      },
    });
  }

  contractLabel(userId: string): string {
    const status = this.contractStatusMap().get(userId);
    if (!status) return 'No Contract';
    return status === 'ACTIVE' ? 'Active' : 'Suspended';
  }

  contractBadgeClass(userId: string): string {
    const status = this.contractStatusMap().get(userId);
    if (!status) return 'bg-gray-100 text-gray-400';
    return status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
  }

  departmentLabel(value?: string): string {
    if (!value) return '—';
    return DEPARTMENTS.find(d => d.value === value)?.label ?? value;
  }

  private emptyUserForm(): AddUserForm {
    return { name: '', email: '', password: '', phoneNumber: '', address: '', nationalId: '', dateOfBirth: '', role: 'AGENT' };
  }

  roleClass(role: UserRole): string {
    const map: Record<string, string> = {
      SYSTEM_ADMIN:      'bg-red-100 text-red-700',
      ORG_ADMIN:         'bg-indigo-100 text-indigo-700',
      AGENT:             'bg-blue-100 text-blue-700',
      ADMIN:             'bg-purple-100 text-purple-700',
      HR:                'bg-pink-100 text-pink-700',
      IT:                'bg-cyan-100 text-cyan-700',
      OPERATIONS:        'bg-orange-100 text-orange-700',
      MANAGER:           'bg-violet-100 text-violet-700',
      CALL_CENTER_AGENT: 'bg-teal-100 text-teal-700',
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
