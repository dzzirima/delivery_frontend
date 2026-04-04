import { Component, Input, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Application } from '../../../applications/models/application.model';
import { OnboardingInformation, OnboardingInformationPayload } from '../../models/onboarding-information.model';
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

  entries = signal<OnboardingInformation[]>([]);
  loading = signal(true);
  saving = signal(false);
  deleting = signal<string | null>(null);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  error = signal('');

  form: { notes: string; onBoardingDate: string } = { notes: '', onBoardingDate: '' };

  constructor(
    private onboardingService: OnboardingInformationService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.load();
  }

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
    this.form = { notes: '', onBoardingDate: '' };
    this.editingId.set(null);
    this.showForm.set(true);
  }

  openEdit(entry: OnboardingInformation) {
    this.form = {
      notes: entry.notes,
      onBoardingDate: entry.onBoardingDate ?? '',
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
    };

    const id = this.editingId();

    if (id) {
      this.onboardingService.update(id, payload).subscribe({
        next: res => {
          this.toast.success('Onboarding information updated!');
          this.entries.update(list => list.map(e => (e.id === id ? res.data : e)));
          this.showForm.set(false);
          this.editingId.set(null);
          this.saving.set(false);
        },
        error: () => {
          this.error.set('Failed to update onboarding information.');
          this.saving.set(false);
        },
      });
    } else {
      this.onboardingService.create(payload).subscribe({
        next: res => {
          this.toast.success('Onboarding information created!');
          this.entries.update(list => [res.data, ...list]);
          this.showForm.set(false);
          this.saving.set(false);
        },
        error: () => {
          this.error.set('Failed to create onboarding information.');
          this.saving.set(false);
        },
      });
    }
  }

  remove(id: string) {
    this.deleting.set(id);
    this.onboardingService.delete(id).subscribe({
      next: () => {
        this.toast.success('Onboarding information deleted.');
        this.entries.update(list => list.filter(e => e.id !== id));
        this.deleting.set(null);
      },
      error: () => {
        this.error.set('Failed to delete onboarding information.');
        this.deleting.set(null);
      },
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
