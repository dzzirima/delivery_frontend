import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InterviewService } from '../interviews/services/interview.service';
import { ApplicationService } from '../applications/services/application.service';
import { Interview, InterviewStatus, INTERVIEW_STATUSES } from '../interviews/models/interview.model';
import { Application } from '../applications/models/application.model';

interface ScheduleEntry {
  interview: Interview;
  application?: Application;
}

@Component({
  selector: 'app-calendar',
  imports: [RouterLink, FormsModule],
  templateUrl: './calendar.html',
})
export class Calendar implements OnInit {
  loading  = signal(false);
  error    = signal('');
  entries  = signal<ScheduleEntry[]>([]);
  savingId = signal<string | null>(null);   // id of interview currently being saved

  readonly statuses = INTERVIEW_STATUSES;

  upcoming = computed(() =>
    this.entries()
      .filter(e => new Date(e.interview.interviewDateTime) >= new Date(new Date().setHours(0, 0, 0, 0)))
      .sort((a, b) => new Date(a.interview.interviewDateTime).getTime() - new Date(b.interview.interviewDateTime).getTime())
  );

  past = computed(() =>
    this.entries()
      .filter(e => new Date(e.interview.interviewDateTime) < new Date(new Date().setHours(0, 0, 0, 0)))
      .sort((a, b) => new Date(b.interview.interviewDateTime).getTime() - new Date(a.interview.interviewDateTime).getTime())
  );

  constructor(
    private interviewService: InterviewService,
    private appService: ApplicationService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.interviewService.getAll({ page: 0, size: 200 }).subscribe({
      next: interviewsRes => {
        const interviews = interviewsRes.data?.content ?? [];
        this.appService.getAll({ page: 0, size: 1000 }).subscribe({
          next: appsRes => {
            const apps = appsRes.data?.content ?? [];
            const appMap = new Map(apps.map((a: Application) => [a.id, a]));
            this.entries.set(interviews.map(iv => ({ interview: iv, application: appMap.get(iv.applicationId) })));
            this.loading.set(false);
          },
          error: () => {
            this.entries.set(interviews.map(iv => ({ interview: iv })));
            this.loading.set(false);
          },
        });
      },
      error: () => { this.error.set('Failed to load interview schedule.'); this.loading.set(false); },
    });
  }

  changeStatus(interview: Interview, newStatus: InterviewStatus) {
    if (interview.status === newStatus) return;
    this.savingId.set(interview.id);
    this.interviewService.update(interview.id, { status: newStatus }).subscribe({
      next: res => {
        this.entries.update(list =>
          list.map(e => e.interview.id === interview.id
            ? { ...e, interview: res.data }
            : e
          )
        );
        this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  /** "Today", "Tomorrow", "In 3h 20m", "In 4 days" */
  timeLabel(dt: string): string {
    const now     = new Date();
    const date    = new Date(dt);
    const diffMin = Math.round((date.getTime() - now.getTime()) / 60000);

    if (this.isToday(dt)) return 'Today';
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    if (diffMin < 0) {
      const abs = Math.abs(diffMin);
      if (abs < 60)   return `${abs}m ago`;
      if (abs < 1440) return `${Math.floor(abs / 60)}h ago`;
      return `${Math.floor(abs / 1440)}d ago`;
    }
    if (diffMin < 60)   return `In ${diffMin}m`;
    if (diffMin < 1440) {
      const h = Math.floor(diffMin / 60), m = diffMin % 60;
      return m > 0 ? `In ${h}h ${m}m` : `In ${h}h`;
    }
    return `In ${Math.floor(diffMin / 1440)} days`;
  }

  urgency(dt: string): 'today' | 'soon' | 'upcoming' {
    if (this.isToday(dt)) return 'today';
    return new Date(dt).getTime() - Date.now() < 172800000 ? 'soon' : 'upcoming';
  }

  isToday(dt: string): boolean {
    return new Date(dt).toDateString() === new Date().toDateString();
  }

  isLink(val?: string): boolean {
    return /^https?:\/\//i.test(val?.trim() ?? '');
  }

  formatTime(dt: string): string {
    return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  dayAbbr(dt: string): string {
    return new Date(dt).toLocaleDateString('en-GB', { weekday: 'short' }); // Mon, Tue…
  }

  dayNum(dt: string): string {
    return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit' });
  }

  statusClass(status: InterviewStatus): string {
    const map: Record<InterviewStatus, string> = {
      SCHEDULED:   'bg-blue-50 text-blue-700 border border-blue-200',
      RESCHEDULED: 'bg-amber-50 text-amber-700 border border-amber-200',
      COMPLETED:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
      CANCELLED:   'bg-red-50 text-red-700 border border-red-200',
      NO_SHOW:     'bg-slate-100 text-slate-500 border border-slate-200',
    };
    return map[status] ?? 'bg-slate-100 text-slate-500 border border-slate-200';
  }

  selectClass(status: InterviewStatus): string {
    const map: Record<InterviewStatus, string> = {
      SCHEDULED:   'bg-blue-50 text-blue-700 border-blue-200',
      RESCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
      COMPLETED:   'bg-emerald-50 text-emerald-700 border-emerald-200',
      CANCELLED:   'bg-red-50 text-red-700 border-red-200',
      NO_SHOW:     'bg-slate-100 text-slate-500 border-slate-200',
    };
    return map[status] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  }
}
