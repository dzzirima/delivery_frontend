import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrgMemberService, OrgMember } from './members.service';
import { BikeService, Bike } from '../fleet/fleet.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterModule],
  templateUrl: './members.html',
})
export class Members implements OnInit {
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
  resetPasswordTarget = signal<OrgMember | null>(null);
  resetPasswordValue  = '';
  showResetPassword   = signal(false);
  resetPasswordSaving = signal(false);
  resetPasswordError  = signal('');

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
    const member = this.resetPasswordTarget();
    if (!member || !this.resetPasswordValue.trim()) return;
    this.resetPasswordSaving.set(true);
    this.orgMemberService.resetPassword(member.id, this.resetPasswordValue).subscribe({
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

  // ── Members ─────────────────────────────────────────────────────────────────

  loadMembers() {
    this.membersLoading.set(true);
    const role = this.memberRoleFilter() || undefined;
    this.orgMemberService.list(role).subscribe({
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
    const editing = this.memberEditing();
    this.memberSaving.set(true);

    if (editing) {
      const req: any = {};
      if (this.memberForm.name  !== editing.name)         req['name']  = this.memberForm.name;
      if (this.memberForm.phone !== (editing.phone ?? '')) req['phone'] = this.memberForm.phone;
      if (this.memberForm.role  !== editing.role)         req['role']  = this.memberForm.role;
      this.orgMemberService.update(editing.id, req).subscribe({
        next: () => { this.memberSaving.set(false); this.closeMemberModal(); this.loadMembers(); this.toast.success('Success', 'Member updated.'); },
        error: (e) => { this.memberSaving.set(false); this.memberModalError.set(e?.error?.message ?? 'Failed to update member.'); },
      });
    } else {
      this.orgMemberService.add({
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
    this.orgMemberService.remove(userId).subscribe({
      next:  () => { this.memberRemovingId.set(null); this.loadMembers(); this.toast.success('Success', 'Member removed from organisation.'); },
      error: (e) => { this.memberRemovingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to remove member.'); },
    });
  }

  // ── Bike pairing ─────────────────────────────────────────────────────────────

  pairTarget    = signal<OrgMember | null>(null);
  pairBikeId    = signal('');
  pairSaving    = signal(false);
  pairError     = signal('');
  availableBikes = signal<Bike[]>([]);
  bikesLoading  = signal(false);
  unpairingId   = signal<string | null>(null);

  openPairModal(m: OrgMember) {
    this.pairTarget.set(m);
    this.pairBikeId.set('');
    this.pairError.set('');
    this.availableBikes.set([]);
    this.bikesLoading.set(true);
    this.bikeService.getAll().subscribe({
      next: r => {
        const unassigned = (Array.isArray(r.data) ? r.data : [])
          .filter(b => b.status === 'ACTIVE' && !b.assignedRiderId);
        this.availableBikes.set(unassigned);
        this.bikesLoading.set(false);
      },
      error: () => { this.bikesLoading.set(false); this.pairError.set('Failed to load available bikes.'); },
    });
  }

  closePairModal() { this.pairTarget.set(null); this.pairError.set(''); }

  savePairing() {
    const member = this.pairTarget();
    const bikeId = this.pairBikeId();
    if (!member || !bikeId) return;
    this.pairSaving.set(true);
    this.bikeService.assignRider(bikeId, member.id).subscribe({
      next: () => {
        this.pairSaving.set(false);
        this.closePairModal();
        this.loadMembers();
        this.toast.success('Success', 'Bike paired to rider.');
      },
      error: (e) => { this.pairSaving.set(false); this.pairError.set(e?.error?.message ?? 'Failed to pair bike.'); },
    });
  }

  unpairRider(m: OrgMember) {
    if (!m.assignedBikeId) return;
    this.unpairingId.set(m.id);
    this.bikeService.unassignRider(m.assignedBikeId).subscribe({
      next: () => {
        this.unpairingId.set(null);
        // Update the member in-place immediately, then confirm with a fresh load
        this.members.update(list =>
          list.map(x => x.id === m.id ? { ...x, assignedBikeId: null, assignedBikeRegNumber: null } : x)
        );
        this.loadMembers();
        this.toast.success('Success', 'Bike unassigned from rider.');
      },
      error: (e) => { this.unpairingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to unpair bike.'); },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  memberRoleColor(role: string): string {
    return role === 'RIDER' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700';
  }

  memberStatusColor(status: string): string {
    return status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500';
  }

  constructor(
    private orgMemberService: OrgMemberService,
    private bikeService:      BikeService,
    private toast:            ToastService,
  ) {}

  ngOnInit() {
    this.loadMembers();
  }
}
