import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApplicationDetails, ApplicationStatus } from '../models/application.model';
import { Interview, InterviewPayload, INTERVIEW_STATUSES, InterviewStatus } from '../../interviews/models/interview.model';
import { FollowUp } from '../../follow-ups/models/follow-up.model';
import { OnboardingInformation } from '../../onboarding-process/models/onboarding-information.model';
import { Gig } from '../../gigs/models/gig.model';
import { InterviewService } from '../../interviews/services/interview.service';
import { FollowUpService } from '../../follow-ups/services/follow-up.service';
import { OnboardingInformationService } from '../../onboarding-process/services/onboarding-information.service';
import { GigService } from '../../gigs/services/gig.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-application-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './application-detail.html',
})
export class ApplicationDetailPage implements OnInit {
  readonly interviewStatuses = INTERVIEW_STATUSES;

  app: ApplicationDetails;
  interviews = signal<Interview[]>([]);
  followUps = signal<FollowUp[]>([]);
  onboardingEntries = signal<OnboardingInformation[]>([]);
  loadingOnboarding = signal(true);

  /** The single gig linked to this application, if it exists. */
  gig = signal<Gig | null>(null);
  loadingGig = signal(true);

  showInterviewForm = signal(false);
  savingInterview = signal(false);
  interviewForm: Omit<InterviewPayload, 'applicationId'> = this.emptyInterviewForm();

  showFollowUpForm = signal(false);
  savingFollowUp = signal(false);
  followUpForm = { message: '', followUpDate: '' };

  showOnboardingForm = signal(false);
  savingOnboarding = signal(false);
  editingOnboardingId = signal<string | null>(null);
  deletingOnboardingId = signal<string | null>(null);
  onboardingForm = { notes: '', onBoardingDate: '' };

  constructor(
    route: ActivatedRoute,
    private router: Router,
    private interviewService: InterviewService,
    private followUpService: FollowUpService,
    private onboardingService: OnboardingInformationService,
    private gigService: GigService,
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

  ngOnInit() {
    this.onboardingService.getByApplicationId(this.app.id).subscribe({
      next: res => {
        this.onboardingEntries.set(Array.isArray(res.data) ? res.data : []);
        this.loadingOnboarding.set(false);
      },
      error: () => this.loadingOnboarding.set(false),
    });

    this.gigService.getByApplicationId(this.app.id).subscribe({
      next: res => {
        this.gig.set(res.data ?? null);
        this.loadingGig.set(false);
      },
      error: () => this.loadingGig.set(false),
    });
  }

  // ── Gig navigation ─────────────────────────────────────────────────────

  navigateToCreateGig() {
    this.router.navigate(['/app/gigs/create'], {
      queryParams: {
        applicationId: this.app.id,
        company: this.app.company,
        position: this.app.position,
      },
    });
  }

  navigateToGig() {
    if (this.gig()) {
      this.router.navigate(['/app/gigs', this.gig()!.id]);
    }
  }

  // ── Interviews ─────────────────────────────────────────────────────────

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

  // ── Follow-ups ─────────────────────────────────────────────────────────

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

  // ── Onboarding ─────────────────────────────────────────────────────────

  openOnboardingEdit(entry: OnboardingInformation) {
    this.onboardingForm = { notes: entry.notes, onBoardingDate: entry.onBoardingDate ?? '' };
    this.editingOnboardingId.set(entry.id);
    this.showOnboardingForm.set(true);
  }

  cancelOnboardingForm() {
    this.showOnboardingForm.set(false);
    this.editingOnboardingId.set(null);
    this.onboardingForm = { notes: '', onBoardingDate: '' };
  }

  saveOnboarding() {
    if (!this.onboardingForm.notes.trim()) return;
    this.savingOnboarding.set(true);
    const payload = {
      applicationId: this.app.id,
      notes: this.onboardingForm.notes,
      onBoardingDate: this.onboardingForm.onBoardingDate || null,
    };
    const editId = this.editingOnboardingId();
    if (editId) {
      this.onboardingService.update(editId, payload).subscribe({
        next: res => {
          this.onboardingEntries.update(list => list.map(e => (e.id === editId ? res.data : e)));
          this.toast.success('Onboarding entry updated!');
          this.cancelOnboardingForm();
          this.savingOnboarding.set(false);
        },
        error: () => {
          this.toast.error('Failed to update onboarding entry.');
          this.savingOnboarding.set(false);
        },
      });
    } else {
      this.onboardingService.create(payload).subscribe({
        next: res => {
          this.onboardingEntries.update(list => [res.data, ...list]);
          this.toast.success('Onboarding entry added!');
          this.cancelOnboardingForm();
          this.savingOnboarding.set(false);
        },
        error: () => {
          this.toast.error('Failed to add onboarding entry.');
          this.savingOnboarding.set(false);
        },
      });
    }
  }

  deleteOnboarding(id: string) {
    if (!confirm('Delete this onboarding entry?')) return;
    this.deletingOnboardingId.set(id);
    this.onboardingService.delete(id).subscribe({
      next: () => {
        this.onboardingEntries.update(list => list.filter(e => e.id !== id));
        this.toast.success('Onboarding entry deleted.');
        this.deletingOnboardingId.set(null);
      },
      error: () => {
        this.toast.error('Failed to delete onboarding entry.');
        this.deletingOnboardingId.set(null);
      },
    });
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  statusConfig(status: ApplicationStatus) {
    const map: Record<ApplicationStatus, { badge: string; dot: string }> = {
      APPLIED:    { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
      PENDING:    { badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
      INTERVIEW:  { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
      ASSESSMENT: { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
      REJECTED:   { badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
      OFFER:      { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
      ON_HOLD:    { badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
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
