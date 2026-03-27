import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Application,
  ApplicationPayload,
  APPLICATION_STATUSES,
  ApplicationStatus,
} from './models/application.model';
import { ApplicationService } from './services/application.service';
import { ToastService } from '../../core/toast.service';
import { AppForm } from './ui/app-form/app-form';
import { InterviewsPanel } from './ui/interviews-panel/interviews-panel';
import { FollowUpsPanel } from '../follow-ups/ui/follow-ups-panel/follow-ups-panel';

@Component({
  selector: 'app-applications',
  imports: [FormsModule, AppForm, InterviewsPanel, FollowUpsPanel],
  templateUrl: './applications.html',
})
export class Applications implements OnInit {
  readonly statuses = APPLICATION_STATUSES;

  applications = signal<Application[]>([]);
  loading = signal(false);
  error = signal('');
  totalElements = signal(0);

  filterStatus = signal<ApplicationStatus | ''>('');
  searchQuery = '';

  showAppForm = signal(false);
  editingApp = signal<Application | null>(null);
  viewingApp = signal<Application | null>(null);
  followUpsApp = signal<Application | null>(null);
  saving = signal(false);

  constructor(
    private appService: ApplicationService,
    private toast: ToastService,
    private router: Router,
  ) {}

  viewDetails(id: string) {
    this.router.navigate(['/app/applications', id]);
  }

  ngOnInit() {
    this.loadApplications();
  }

  loadApplications() {
    this.loading.set(true);
    this.error.set('');
    this.appService
      .getAll({
        status: this.filterStatus() || undefined,
        search: this.searchQuery || undefined,
        page: 0,
        size: 20,
      })
      .subscribe({
        next: res => {
          const page = res.data;
          this.applications.set(page?.content ?? []);
          this.totalElements.set(page?.totalElements ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load applications.');
          this.loading.set(false);
        },
      });
  }

  onStatusChange() {
    this.loadApplications();
  }

  onSearch() {
    this.loadApplications();
  }

  openNewForm() {
    this.editingApp.set(null);
    this.showAppForm.set(true);
  }

  openEdit(app: Application) {
    this.editingApp.set(app);
    this.showAppForm.set(true);
  }

  closeAppForm() {
    this.showAppForm.set(false);
    this.editingApp.set(null);
  }

  openInterviews(app: Application) {
    this.viewingApp.set(app);
  }

  openFollowUps(app: Application) {
    this.followUpsApp.set(app);
  }

  saveApplication(payload: ApplicationPayload) {
    this.saving.set(true);
    const editing = this.editingApp();
    const request$ = editing
      ? this.appService.update(editing.id, payload)
      : this.appService.create(payload);

    request$.subscribe({
      next: () => {
        this.toast.success(editing ? 'Application updated!' : 'Application added!');
        this.showAppForm.set(false);
        this.editingApp.set(null);
        this.saving.set(false);
        this.loadApplications();
      },
      error: () => {
        this.toast.error('Failed to save application.');
        this.saving.set(false);
      },
    });
  }

  deleteApp(id: string) {
    if (!confirm('Delete this application and all its interviews?')) return;
    this.appService.delete(id).subscribe({
      next: () => {
        this.toast.success('Application deleted.');
        this.applications.update(list => list.filter(a => a.id !== id));
        this.totalElements.update(n => n - 1);
      },
      error: () => this.toast.error('Failed to delete application.'),
    });
  }

  statusClass(status: ApplicationStatus): string {
    const map: Record<ApplicationStatus, string> = {
      APPLIED:    'bg-blue-100 text-blue-700',
      PENDING:    'bg-amber-100 text-amber-700',
      INTERVIEW:  'bg-indigo-100 text-indigo-700',
      ASSESSMENT: 'bg-violet-100 text-violet-700',
      REJECTED:   'bg-red-100 text-red-700',
      OFFER:      'bg-green-100 text-green-700',
      ON_HOLD:    'bg-gray-100 text-gray-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
