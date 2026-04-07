import { Component, Input, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Application } from '../../../applications/models/application.model';
import {
  OnboardingInformation,
  OnboardingInformationPayload,
  OnboardingLinkPayload,
  OnboardingStatus,
  OnboardingType,
  ONBOARDING_STATUSES,
  ONBOARDING_TYPES,
} from '../../models/onboarding-information.model';
import { OnboardingInformationService } from '../../services/onboarding-information.service';
import { ToastService } from '../../../../core/toast.service';

@Component({
  selector: 'app-onboarding-process-panel',
  imports: [FormsModule],
  templateUrl: './onboarding-process-panel.html',
})
export class OnboardingProcessPanel implements OnInit {
  @Input({ required: true }) application!: Application;
  @Output() closed = new EventEmitter<void>();

  entries    = signal<OnboardingInformation[]>([]);
  loading    = signal(true);
  saving     = signal(false);
  deleting   = signal<string | null>(null);
  showForm   = signal(false);
  editingId  = signal<string | null>(null);
  error      = signal('');

  // Per-entry link form state: keyed by entry id
  linkFormEntryId = signal<string | null>(null);
  savingLink      = signal(false);
  deletingLink    = signal<string | null>(null);

  readonly onboardingTypes   = ONBOARDING_TYPES;
  readonly onboardingStatuses = ONBOARDING_STATUSES;

  form: {
    notes: string;
    onBoardingDate: string;
    type: OnboardingType | '';
    status: OnboardingStatus;
  } = { notes: '', onBoardingDate: '', type: '', status: 'PENDING' };

  linkForm: { url: string; label: string; expiryDate: string } = {
    url: '', label: '', expiryDate: '',
  };

  constructor(
    private onboardingService: OnboardingInformationService,
    private toast: ToastService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.onboardingService.getByApplicationId(this.application.id).subscribe({
      next: res => {
        this.entries.set(Array.isArray(res.data) ? res.data : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load onboarding information.');
        this.loading.set(false);
      },
    });
  }

  openForm() {
    this.form = { notes: '', onBoardingDate: '', type: '', status: 'PENDING' };
    this.editingId.set(null);
    this.showForm.set(true);
  }

  openEdit(entry: OnboardingInformation) {
    this.form = {
      notes: entry.notes,
      onBoardingDate: entry.onBoardingDate ?? '',
      type: entry.type ?? '',
      status: entry.status ?? 'PENDING',
    };
    this.editingId.set(entry.id);
    this.showForm.set(true);
  }

  cancelForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  submit() {
    if (!this.form.notes.trim()) return;
    this.saving.set(true);
    this.error.set('');

    const payload: OnboardingInformationPayload = {
      applicationId: this.application.id,
      notes: this.form.notes,
      onBoardingDate: this.form.onBoardingDate || null,
      type: this.form.type || undefined,
      status: this.form.status,
    };

    const id = this.editingId();

    if (id) {
      this.onboardingService.update(id, payload).subscribe({
        next: res => {
          this.toast.success('Onboarding entry updated!');
          this.entries.update(list => list.map(e => e.id === id ? res.data : e));
          this.showForm.set(false);
          this.editingId.set(null);
          this.saving.set(false);
        },
        error: () => {
          this.error.set('Failed to update onboarding entry.');
          this.saving.set(false);
        },
      });
    } else {
      this.onboardingService.create(payload).subscribe({
        next: res => {
          this.toast.success('Onboarding entry created!');
          this.entries.update(list => [res.data, ...list]);
          this.showForm.set(false);
          this.saving.set(false);
        },
        error: () => {
          this.error.set('Failed to create onboarding entry.');
          this.saving.set(false);
        },
      });
    }
  }

  remove(id: string) {
    this.deleting.set(id);
    this.onboardingService.delete(id).subscribe({
      next: () => {
        this.toast.success('Onboarding entry deleted.');
        this.entries.update(list => list.filter(e => e.id !== id));
        this.deleting.set(null);
      },
      error: () => {
        this.error.set('Failed to delete onboarding entry.');
        this.deleting.set(null);
      },
    });
  }

  // ── Link management ──────────────────────────────────────────────────

  toggleLinkForm(entryId: string) {
    if (this.linkFormEntryId() === entryId) {
      this.linkFormEntryId.set(null);
    } else {
      this.linkForm = { url: '', label: '', expiryDate: '' };
      this.linkFormEntryId.set(entryId);
    }
  }

  submitLink(entryId: string) {
    if (!this.linkForm.url.trim()) return;
    this.savingLink.set(true);

    const payload: OnboardingLinkPayload = {
      url: this.linkForm.url.trim(),
      label: this.linkForm.label.trim() || undefined,
      expiryDate: this.linkForm.expiryDate || undefined,
    };

    this.onboardingService.addLink(entryId, payload).subscribe({
      next: res => {
        this.entries.update(list => list.map(e => e.id === entryId ? res.data : e));
        this.linkForm = { url: '', label: '', expiryDate: '' };
        this.linkFormEntryId.set(null);
        this.savingLink.set(false);
        this.toast.success('Link added!');
      },
      error: () => {
        this.error.set('Failed to add link.');
        this.savingLink.set(false);
      },
    });
  }

  removeLink(entryId: string, linkId: string) {
    this.deletingLink.set(linkId);
    this.onboardingService.removeLink(entryId, linkId).subscribe({
      next: res => {
        this.entries.update(list => list.map(e => e.id === entryId ? res.data : e));
        this.deletingLink.set(null);
        this.toast.success('Link removed.');
      },
      error: () => {
        this.error.set('Failed to remove link.');
        this.deletingLink.set(null);
      },
    });
  }

  // ── Display helpers ──────────────────────────────────────────────────

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatEnum(val?: string): string {
    return val ? val.split('_').join(' ') : 'N/A';
  }

  typeColor(type?: string): string {
    const map: Record<string, string> = {
      TECHNICAL_ENGINEERING: 'bg-blue-50 text-blue-700 border-blue-200',
      OPERATIONAL_HR:        'bg-purple-50 text-purple-700 border-purple-200',
      PRODUCT_DOMAIN:        'bg-teal-50 text-teal-700 border-teal-200',
      REMOTE_ASYNCHRONOUS:   'bg-orange-50 text-orange-700 border-orange-200',
      GENERAL:               'bg-slate-50 text-slate-600 border-slate-200',
    };
    return map[type ?? ''] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  }

  statusColor(status?: string): string {
    const map: Record<string, string> = {
      PENDING:   'bg-amber-50 text-amber-700 border-amber-200',
      COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      MISSED:    'bg-red-50 text-red-700 border-red-200',
    };
    return map[status ?? ''] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  }

  /** Returns expiry info: { label, color } */
  expiryInfo(expiryDate?: string): { label: string; color: string } | null {
    if (!expiryDate) return null;
    const now   = new Date();
    const exp   = new Date(expiryDate);
    const diffMs = exp.getTime() - now.setHours(0, 0, 0, 0);
    const days   = Math.ceil(diffMs / 86400000);

    if (days < 0)  return { label: `Expired ${Math.abs(days)}d ago`, color: 'text-red-600' };
    if (days === 0) return { label: 'Expires today',                  color: 'text-amber-600' };
    if (days <= 7)  return { label: `Expires in ${days}d`,            color: 'text-amber-500' };
    return {
      label: `Expires ${exp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      color: 'text-emerald-600',
    };
  }
}
