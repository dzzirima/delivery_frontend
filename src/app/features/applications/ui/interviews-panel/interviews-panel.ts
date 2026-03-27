import { Component, Input, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Application } from '../../models/application.model';
import { Interview, InterviewPayload, INTERVIEW_STATUSES, InterviewStatus } from '../../../interviews/models/interview.model';
import { InterviewService } from '../../../interviews/services/interview.service';
import { ToastService } from '../../../../core/toast.service';

@Component({
  selector: 'app-interviews-panel',
  imports: [FormsModule],
  templateUrl: './interviews-panel.html',
})
export class InterviewsPanel implements OnInit {
  @Input({ required: true }) application!: Application;
  @Output() closed = new EventEmitter<void>();

  readonly interviewStatuses = INTERVIEW_STATUSES;

  interviews = signal<Interview[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  editingInterview = signal<Interview | null>(null);
  error = signal('');

  form: InterviewPayload = this.emptyForm();

  constructor(private interviewService: InterviewService, private toast: ToastService) {}

  ngOnInit() {
    this.loadInterviews();
  }

  loadInterviews() {
    this.loading.set(true);
    this.interviewService.getByApplicationId(this.application.id).subscribe({
      next: res => {
        this.interviews.set(Array.isArray(res.data) ? res.data : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load interviews.');
        this.loading.set(false);
      },
    });
  }

  openNewForm() {
    this.editingInterview.set(null);
    this.form = this.emptyForm();
    this.showForm.set(true);
  }

  openEditForm(interview: Interview) {
    this.editingInterview.set(interview);
    this.form = {
      applicationId: interview.applicationId,
      interviewDateTime: interview.interviewDateTime?.slice(0, 16) ?? '',
      interviewerName: interview.interviewerName ?? '',
      interviewerPhone: interview.interviewerPhone ?? '',
      documentsRequired: interview.documentsRequired ?? '',
      meetingLinkOrLocation: interview.meetingLinkOrLocation ?? '',
      notes: interview.notes ?? '',
      status: interview.status,
    };
    this.showForm.set(true);
  }

  cancelForm() {
    this.showForm.set(false);
    this.editingInterview.set(null);
  }

  saveInterview() {
    if (!this.form.interviewDateTime) {
      this.error.set('Interview date and time is required.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const payload: InterviewPayload = { ...this.form, applicationId: this.application.id };
    const editing = this.editingInterview();

    const request$ = editing
      ? this.interviewService.update(editing.id, payload)
      : this.interviewService.create(payload);

    request$.subscribe({
      next: () => {
        this.toast.success(editing ? 'Interview updated!' : 'Interview scheduled!');
        this.showForm.set(false);
        this.editingInterview.set(null);
        this.saving.set(false);
        this.loadInterviews();
      },
      error: () => {
        this.error.set('Failed to save interview.');
        this.saving.set(false);
      },
    });
  }

  deleteInterview(id: string) {
    if (!confirm('Delete this interview?')) return;
    this.interviewService.delete(id).subscribe({
      next: () => {
        this.toast.success('Interview deleted.');
        this.interviews.update(list => list.filter(i => i.id !== id));
      },
      error: () => this.toast.error('Failed to delete interview.'),
    });
  }

  interviewStatusClass(status: InterviewStatus): string {
    const map: Record<InterviewStatus, string> = {
      SCHEDULED:   'bg-blue-100 text-blue-700',
      RESCHEDULED: 'bg-amber-100 text-amber-700',
      COMPLETED:   'bg-green-100 text-green-700',
      CANCELLED:   'bg-red-100 text-red-700',
      NO_SHOW:     'bg-gray-100 text-gray-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  formatDateTime(dt: string): string {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  private emptyForm(): InterviewPayload {
    return {
      applicationId: '',
      interviewDateTime: '',
      interviewerName: '',
      interviewerPhone: '',
      documentsRequired: '',
      meetingLinkOrLocation: '',
      notes: '',
      status: 'SCHEDULED',
    };
  }
}
