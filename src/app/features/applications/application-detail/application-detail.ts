import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApplicationDetails, ApplicationStatus } from '../models/application.model';
import { Interview, InterviewPayload, INTERVIEW_STATUSES, InterviewStatus } from '../../interviews/models/interview.model';
import { FollowUp } from '../../follow-ups/models/follow-up.model';
import { InterviewService } from '../../interviews/services/interview.service';
import { FollowUpService } from '../../follow-ups/services/follow-up.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-application-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './application-detail.html',
})
export class ApplicationDetailPage {
  readonly interviewStatuses = INTERVIEW_STATUSES;

  app: ApplicationDetails;
  interviews = signal<Interview[]>([]);
  followUps = signal<FollowUp[]>([]);

  showInterviewForm = signal(false);
  savingInterview = signal(false);
  interviewForm: Omit<InterviewPayload, 'applicationId'> = this.emptyInterviewForm();

  showFollowUpForm = signal(false);
  savingFollowUp = signal(false);
  followUpForm = { message: '', followUpDate: '' };

  constructor(
    route: ActivatedRoute,
    private interviewService: InterviewService,
    private followUpService: FollowUpService,
    private toast: ToastService,
  ) {
    this.app = route.snapshot.data['application'] as ApplicationDetails;
    this.interviews.set(
      [...(this.app.interviews ?? [])].sort(
        (a, b) => new Date(a.interviewDateTime).getTime() - new Date(b.interviewDateTime).getTime(),
      ),
    );
    this.followUps.set(this.app.followUps ?? []);
  }

  addInterview() {
    if (!this.interviewForm.interviewDateTime) return;
    this.savingInterview.set(true);
    this.interviewService
      .create({ applicationId: this.app.id, ...this.interviewForm })
      .subscribe({
        next: res => {
          this.interviews.update(list =>
            [...list, res.data].sort(
              (a, b) => new Date(a.interviewDateTime).getTime() - new Date(b.interviewDateTime).getTime(),
            ),
          );
          this.toast.success('Interview scheduled!');
          this.showInterviewForm.set(false);
          this.interviewForm = this.emptyInterviewForm();
          this.savingInterview.set(false);
        },
        error: () => {
          this.toast.error('Failed to schedule interview.');
          this.savingInterview.set(false);
        },
      });
  }

  addFollowUp() {
    if (!this.followUpForm.message.trim() || !this.followUpForm.followUpDate) return;
    this.savingFollowUp.set(true);
    this.followUpService
      .create({ applicationId: this.app.id, ...this.followUpForm })
      .subscribe({
        next: res => {
          this.followUps.update(list => [res.data, ...list]);
          this.toast.success('Follow-up logged!');
          this.showFollowUpForm.set(false);
          this.followUpForm = { message: '', followUpDate: '' };
          this.savingFollowUp.set(false);
        },
        error: () => {
          this.toast.error('Failed to log follow-up.');
          this.savingFollowUp.set(false);
        },
      });
  }

  deleteInterview(id: string) {
    if (!confirm('Delete this interview?')) return;
    this.interviewService.delete(id).subscribe({
      next: () => {
        this.interviews.update(list => list.filter(i => i.id !== id));
        this.toast.success('Interview deleted.');
      },
      error: () => this.toast.error('Failed to delete interview.'),
    });
  }

  statusConfig(status: ApplicationStatus) {
    const map: Record<ApplicationStatus, { badge: string; dot: string }> = {
      APPLIED:    { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
      PENDING:    { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
      INTERVIEW:  { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
      ASSESSMENT: { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
      REJECTED:   { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
      OFFER:      { badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
      ON_HOLD:    { badge: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
    };
    return map[status] ?? map['ON_HOLD'];
  }

  interviewStatusConfig(status: InterviewStatus) {
    const map: Record<InterviewStatus, { badge: string; dot: string }> = {
      SCHEDULED:   { badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
      RESCHEDULED: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
      COMPLETED:   { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
      CANCELLED:   { badge: 'bg-red-100 text-red-600',     dot: 'bg-red-400' },
      NO_SHOW:     { badge: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
    };
    return map[status] ?? map['SCHEDULED'];
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  formatDateTime(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  private emptyInterviewForm(): Omit<InterviewPayload, 'applicationId'> {
    return {
      interviewDateTime: '',
      interviewerName: '',
      interviewerPhone: '',
      documentsRequired: '',
      locationOrLink: '',
      notes: '',
      status: 'SCHEDULED',
    };
  }
}
