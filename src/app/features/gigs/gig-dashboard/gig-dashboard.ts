import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Gig, GigPatch, GigStatusPayload, Overtime, OvertimePayload, EQUIPMENT_TYPES, EquipmentType, OVERTIME_STATUSES, OvertimeStatus } from '../models/gig.model';
import { GigService } from '../services/gig.service';
import { UserService } from '../../users/services/user.service';
import { User } from '../../users/models/user.model';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-gig-dashboard',
  imports: [RouterLink, FormsModule],
  templateUrl: './gig-dashboard.html',
})
export class GigDashboard implements OnInit {
  readonly equipmentTypes = EQUIPMENT_TYPES;
  readonly overtimeStatuses = OVERTIME_STATUSES;

  gig = signal<Gig | null>(null);
  users = signal<User[]>([]);
  overtimes = signal<Overtime[]>([]);

  // Details editing
  editMode = signal(false);
  savingDetails = signal(false);
  editForm: GigPatch = {};

  // Worker assignment
  savingWorker = signal(false);
  selectedWorkerId = '';

  // Status / drop
  showDropForm = signal(false);
  savingStatus = signal(false);
  dropReason = '';

  // Overtime
  showOvertimeForm = signal(false);
  savingOvertime = signal(false);
  deletingOvertimeId = signal<string | null>(null);
  overtimeForm: { overtimeHours: string; overtimeDate: string; status: OvertimeStatus } = {
    overtimeHours: '',
    overtimeDate: '',
    status: 'APPROVED',
  };

  error = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gigService: GigService,
    private userService: UserService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    const loaded = this.route.snapshot.data['gig'] as Gig;
    this.gig.set(loaded);
    this.overtimes.set(loaded.overtimes ?? []);
    this.selectedWorkerId = loaded.workerId ?? '';

    this.userService.getAll({ size: 200 }).subscribe({
      next: res => this.users.set(res.data?.content ?? []),
      error: () => {},
    });
  }

  // ── Details ────────────────────────────────────────────────────────────

  openEdit() {
    const g = this.gig()!;
    this.editForm = {
      startingDate: g.startingDate,
      payRate: g.payRate,
      maximumHoursPerDay: g.maximumHoursPerDay ?? undefined,
      equipmentType: g.equipmentType,
      computerInformation: g.computerInformation ?? '',
      duration: g.duration,
      possibilityOfExtension: g.possibilityOfExtension,
      overtimeRate: g.overtimeRate,
    };
    this.editMode.set(true);
  }

  cancelEdit() {
    this.editMode.set(false);
  }

  saveDetails() {
    this.savingDetails.set(true);
    this.error.set('');
    this.gigService.patch(this.gig()!.id, this.editForm).subscribe({
      next: res => {
        this.gig.set(res.data);
        this.editMode.set(false);
        this.savingDetails.set(false);
        this.toast.success('Gig details updated!');
      },
      error: () => {
        this.error.set('Failed to update details.');
        this.savingDetails.set(false);
      },
    });
  }

  // ── Worker assignment ──────────────────────────────────────────────────

  assignWorker() {
    this.savingWorker.set(true);
    const patch: GigPatch = this.selectedWorkerId
      ? { workerId: this.selectedWorkerId }
      : { clearWorker: true };

    this.gigService.patch(this.gig()!.id, patch).subscribe({
      next: res => {
        this.gig.set(res.data);
        this.savingWorker.set(false);
        this.toast.success('Worker assignment saved!');
      },
      error: () => {
        this.error.set('Failed to assign worker.');
        this.savingWorker.set(false);
      },
    });
  }

  // ── Status / Drop ──────────────────────────────────────────────────────

  dropGig() {
    if (!this.dropReason.trim()) return;
    this.savingStatus.set(true);
    const payload: GigStatusPayload = { status: 'DROPPED', reasonsOfDrop: this.dropReason.trim() };
    this.gigService.updateStatus(this.gig()!.id, payload).subscribe({
      next: res => {
        this.gig.set(res.data);
        this.showDropForm.set(false);
        this.dropReason = '';
        this.savingStatus.set(false);
        this.toast.success('Gig dropped.');
      },
      error: () => {
        this.error.set('Failed to drop gig.');
        this.savingStatus.set(false);
      },
    });
  }

  reactivateGig() {
    this.savingStatus.set(true);
    this.gigService.updateStatus(this.gig()!.id, { status: 'LIVE' }).subscribe({
      next: res => {
        this.gig.set(res.data);
        this.savingStatus.set(false);
        this.toast.success('Gig reactivated!');
      },
      error: () => {
        this.error.set('Failed to reactivate gig.');
        this.savingStatus.set(false);
      },
    });
  }

  // ── Overtime ───────────────────────────────────────────────────────────

  submitOvertime() {
    if (!this.overtimeForm.overtimeHours || !this.overtimeForm.overtimeDate) return;
    this.savingOvertime.set(true);
    const payload: OvertimePayload = {
      overtimeHours: parseFloat(this.overtimeForm.overtimeHours),
      overtimeDate: this.overtimeForm.overtimeDate,
      status: this.overtimeForm.status,
    };
    this.gigService.addOvertime(this.gig()!.id, payload).subscribe({
      next: res => {
        this.overtimes.update(list => [res.data, ...list]);
        this.showOvertimeForm.set(false);
        this.overtimeForm = { overtimeHours: '', overtimeDate: '', status: 'APPROVED' };
        this.savingOvertime.set(false);
        this.toast.success('Overtime entry added!');
      },
      error: () => {
        this.error.set('Failed to add overtime.');
        this.savingOvertime.set(false);
      },
    });
  }

  removeOvertime(id: string) {
    if (!confirm('Delete this overtime entry?')) return;
    this.deletingOvertimeId.set(id);
    this.gigService.deleteOvertime(this.gig()!.id, id).subscribe({
      next: () => {
        this.overtimes.update(list => list.filter(o => o.id !== id));
        this.deletingOvertimeId.set(null);
        this.toast.success('Overtime entry deleted.');
      },
      error: () => {
        this.error.set('Failed to delete overtime entry.');
        this.deletingOvertimeId.set(null);
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  equipmentLabel(type: EquipmentType): string {
    return type === 'COMPANY_OFFER' ? 'Company Offer' : 'Own Equipment';
  }
}
