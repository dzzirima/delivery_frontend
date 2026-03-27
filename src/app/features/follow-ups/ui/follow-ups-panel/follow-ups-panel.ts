import { Component, Input, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Application } from '../../../applications/models/application.model';
import { FollowUp, FollowUpPayload } from '../../models/follow-up.model';
import { FollowUpService } from '../../services/follow-up.service';
import { ToastService } from '../../../../core/toast.service';

@Component({
  selector: 'app-follow-ups-panel',
  imports: [FormsModule],
  templateUrl: './follow-ups-panel.html',
})
export class FollowUpsPanel implements OnInit {
  @Input({ required: true }) application!: Application;
  @Output() closed = new EventEmitter<void>();

  followUps = signal<FollowUp[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  error = signal('');

  form: Omit<FollowUpPayload, 'applicationId'> = { message: '', followUpDate: '' };

  constructor(private followUpService: FollowUpService, private toast: ToastService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.followUpService.getByApplicationId(this.application.id).subscribe({
      next: res => {
        this.followUps.set(Array.isArray(res.data) ? res.data : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load follow-ups.');
        this.loading.set(false);
      },
    });
  }

  openForm() {
    this.form = { message: '', followUpDate: '' };
    this.showForm.set(true);
  }

  cancelForm() {
    this.showForm.set(false);
  }

  submit() {
    if (!this.form.message.trim() || !this.form.followUpDate) return;
    this.saving.set(true);
    this.error.set('');
    const payload: FollowUpPayload = {
      applicationId: this.application.id,
      message: this.form.message,
      followUpDate: this.form.followUpDate,
    };
    this.followUpService.create(payload).subscribe({
      next: res => {
        this.toast.success('Follow-up created!');
        this.followUps.update(list => [res.data, ...list]);
        this.showForm.set(false);
        this.saving.set(false);
      },
      error: () => {
        this.error.set('Failed to create follow-up.');
        this.saving.set(false);
      },
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
