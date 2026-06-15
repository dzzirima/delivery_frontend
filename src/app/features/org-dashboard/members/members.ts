import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrgMemberService, OrgMember } from './members.service';
import { UserService } from '../../users/services/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterModule],
  templateUrl: './members.html',
})
export class Members implements OnInit {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  members           = signal<OrgMember[]>([]);
  membersLoading    = signal(false);
  memberRoleFilter  = signal<string>('');
  memberModal       = signal(false);
  memberSaving      = signal(false);
  memberEditing     = signal<OrgMember | null>(null);
  memberRemovingId  = signal<string | null>(null);
  memberModalError  = signal('');
  memberForm        = { name: '', email: '', phone: '', password: '', role: 'RIDER' as 'RIDER' | 'DISPATCHER' };
  showMemberPassword = signal(false);

  // ── Password reset ──────────────────────────────────────────────────────────
  resetPasswordTarget  = signal<OrgMember | null>(null);
  resetPasswordValue   = '';
  showResetPassword    = signal(false);
  resetPasswordSaving  = signal(false);
  resetPasswordError   = signal('');

  openResetPassword(m: OrgMember) {
    this.resetPasswordTarget.set(m);
    this.resetPasswordValue = '';
    this.showResetPassword.set(false);
    this.resetPasswordError.set('');
  }

  closeResetPassword() {
    this.resetPasswordTarget.set(null);
    this.resetPasswordError.set('');
  }

  saveResetPassword() {
    const orgId  = this.orgId();
    const member = this.resetPasswordTarget();
    if (!orgId || !member || !this.resetPasswordValue.trim()) return;
    this.resetPasswordSaving.set(true);
    this.orgMemberService.resetPassword(orgId, member.id, this.resetPasswordValue).subscribe({
      next: () => {
        this.resetPasswordSaving.set(false);
        this.closeResetPassword();
        this.toast.success('Success', `Password reset for ${member.name}.`);
      },
      error: (e) => {
        this.resetPasswordSaving.set(false);
        this.resetPasswordError.set(e?.error?.message ?? 'Failed to reset password.');
      },
    });
  }

  loadMembers() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.membersLoading.set(true);
    const role = this.memberRoleFilter() || undefined;
    this.orgMemberService.list(orgId, role).subscribe({
      next:  r => { this.members.set(Array.isArray(r.data) ? r.data : []); this.membersLoading.set(false); },
      error: () => { this.membersLoading.set(false); this.toast.error('Error', 'Failed to load members.'); },
    });
  }

  openAddMember() {
    this.memberEditing.set(null);
    this.memberForm = { name: '', email: '', phone: '', password: '', role: 'RIDER' };
    this.showMemberPassword.set(false);
    this.memberModalError.set('');
    this.memberModal.set(true);
  }

  openEditMember(m: OrgMember) {
    this.memberEditing.set(m);
    this.memberForm = { name: m.name, email: m.email, phone: m.phone ?? '', password: '', role: m.role };
    this.showMemberPassword.set(false);
    this.memberModalError.set('');
    this.memberModal.set(true);
  }

  closeMemberModal() { this.memberModalError.set(''); this.memberModal.set(false); }

  saveMember() {
    const orgId = this.orgId();
    if (!orgId) return;
    const editing = this.memberEditing();
    this.memberSaving.set(true);

    if (editing) {
      const req: any = {};
      if (this.memberForm.name  !== editing.name)         req['name']  = this.memberForm.name;
      if (this.memberForm.phone !== (editing.phone ?? '')) req['phone'] = this.memberForm.phone;
      if (this.memberForm.role  !== editing.role)         req['role']  = this.memberForm.role;
      this.orgMemberService.update(orgId, editing.id, req).subscribe({
        next: () => { this.memberSaving.set(false); this.closeMemberModal(); this.loadMembers(); this.toast.success('Success', 'Member updated.'); },
        error: (e) => { this.memberSaving.set(false); this.memberModalError.set(e?.error?.message ?? 'Failed to update member.'); },
      });
    } else {
      this.orgMemberService.add(orgId, {
        name:     this.memberForm.name,
        email:    this.memberForm.email,
        phone:    this.memberForm.phone || undefined,
        password: this.memberForm.password,
        role:     this.memberForm.role,
      }).subscribe({
        next: () => {
          this.memberSaving.set(false);
          this.closeMemberModal();
          this.loadMembers();
          this.toast.success('Success', `${this.memberForm.role === 'RIDER' ? 'Rider' : 'Dispatcher'} added successfully.`);
        },
        error: (e) => { this.memberSaving.set(false); this.memberModalError.set(e?.error?.message ?? 'Failed to add member.'); },
      });
    }
  }

  removeMember(userId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.orgMemberService.remove(orgId, userId).subscribe({
      next:  () => { this.memberRemovingId.set(null); this.loadMembers(); this.toast.success('Success', 'Member removed from organisation.'); },
      error: (e) => { this.memberRemovingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to remove member.'); },
    });
  }

  memberRoleColor(role: string): string {
    return role === 'RIDER' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700';
  }

  memberStatusColor(status: string): string {
    return status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500';
  }

  constructor(
    private orgMemberService: OrgMemberService,
    private userService:      UserService,
    private toast:            ToastService,
  ) {}

  ngOnInit() {
    this.loadMembers();
  }
}
