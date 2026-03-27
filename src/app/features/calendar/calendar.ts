import { Component, OnInit, signal, computed } from '@angular/core';
import { InterviewService } from '../interviews/services/interview.service';
import { ApplicationService } from '../applications/services/application.service';
import { Interview, InterviewStatus } from '../interviews/models/interview.model';
import { Application } from '../applications/models/application.model';

interface ScheduleEntry {
  interview: Interview;
  application?: Application;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.html',
})
export class Calendar implements OnInit {
  loading = signal(false);
  error = signal('');
  entries = signal<ScheduleEntry[]>([]);

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

  ngOnInit() {
    this.load();
  }

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
            this.entries.set(interviews.map(iv => ({
              interview: iv,
              application: appMap.get(iv.applicationId),
            })));
            this.loading.set(false);
          },
          error: () => {
            this.entries.set(interviews.map(iv => ({ interview: iv })));
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Failed to load interview schedule.');
        this.loading.set(false);
      },
    });
  }

  statusClass(status: InterviewStatus): string {
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
      weekday: 'short', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
