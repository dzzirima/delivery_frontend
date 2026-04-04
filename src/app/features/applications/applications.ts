import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, Subscription, switchMap, tap, debounceTime } from 'rxjs';
import {
  Application,
  ApplicationPayload,
  APPLICATION_STATUSES,
  ApplicationStatus,
} from './models/application.model';
import { ApplicationService, ApplicationStats } from './services/application.service';
import { UserService } from '../users/services/user.service';
import { User } from '../users/models/user.model';
import { ToastService } from '../../core/toast.service';
import { AppForm } from './ui/app-form/app-form';
import { InterviewsPanel } from './ui/interviews-panel/interviews-panel';
import { FollowUpsPanel } from '../follow-ups/ui/follow-ups-panel/follow-ups-panel';

@Component({
  selector: 'app-applications',
  imports: [FormsModule, AppForm, InterviewsPanel, FollowUpsPanel],
  templateUrl: './applications.html',
})
export class Applications implements OnInit, OnDestroy {
  readonly statuses = APPLICATION_STATUSES;

  applications = signal<Application[]>([]);
  loading = signal(false);
  error = signal('');
  totalElements = signal(0);
  totalPages = signal(0);

  stats = signal<ApplicationStats | null>(null);

  // Filters (bound to form controls)
  filterStatus = signal<ApplicationStatus | ''>('');
  filterAgentId = '';
  filterFromDate = '';
  filterToDate = '';
  searchQuery = '';
  currentPage = signal(0);
  readonly pageSize = 20;

  agents = signal<User[]>([]);

  showAppForm = signal(false);
  editingApp = signal<Application | null>(null);
  viewingApp = signal<Application | null>(null);
  followUpsApp = signal<Application | null>(null);
  saving = signal(false);

  private filter$ = new Subject<void>();
  private sub = new Subscription();
  private _skipNextQp = false;

  constructor(
    private appService: ApplicationService,
    private userService: UserService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  viewDetails(id: string) {
    this.router.navigate(['/app/applications', id]);
  }

  ngOnInit() {
    // Load agents for the filter dropdown
    this.userService.getAll({ role: 'AGENT', size: 200 }).subscribe({
      next: res => this.agents.set(res.data?.content ?? []),
      error: () => {},
    });

    // Read initial state from URL query params
    const qp = this.route.snapshot.queryParams;
    if (qp['status'])   this.filterStatus.set(qp['status'] as ApplicationStatus);
    if (qp['agentId'])  this.filterAgentId  = qp['agentId'];
    if (qp['fromDate']) this.filterFromDate = qp['fromDate'];
    if (qp['toDate'])   this.filterToDate   = qp['toDate'];
    if (qp['search'])   this.searchQuery    = qp['search'];
    if (qp['page'])     this.currentPage.set(Number(qp['page']) || 0);

    // React to query param changes driven by external navigation (e.g. sidebar sub-items)
    let firstEmission = true;
    this.sub.add(
      this.route.queryParams.subscribe(params => {
        if (firstEmission) { firstEmission = false; return; }
        if (this._skipNextQp) { this._skipNextQp = false; return; }
        this.filterStatus.set((params['status'] as ApplicationStatus) ?? '');
        this.filterAgentId  = params['agentId']  ?? '';
        this.filterFromDate = params['fromDate'] ?? '';
        this.filterToDate   = params['toDate']   ?? '';
        this.searchQuery    = params['search']   ?? '';
        this.currentPage.set(Number(params['page']) || 0);
        this.filter$.next();
      }),
    );

    // Wire up the filter Subject with switchMap to cancel in-flight requests
    this.sub.add(
      this.filter$.pipe(
        tap(() => this.loading.set(true)),
        debounceTime(200),
        switchMap(() => this.appService.getAll({
          status:   this.filterStatus() || undefined,
          agentId:  this.filterAgentId  || undefined,
          fromDate: this.filterFromDate || undefined,
          toDate:   this.filterToDate   || undefined,
          search:   this.searchQuery    || undefined,
          page:     this.currentPage(),
          size:     this.pageSize,
        })),
      ).subscribe({
        next: res => {
          const page = res.data;
          this.applications.set(page?.content ?? []);
          this.totalElements.set(page?.totalElements ?? 0);
          this.totalPages.set(page?.totalPages ?? 0);
          this.loading.set(false);
          this.error.set('');
          // Load stats in parallel (non-cancellable, small payload)
          this.loadStats();
        },
        error: () => {
          this.error.set('Failed to load applications.');
          this.loading.set(false);
        },
      }),
    );

    // Trigger initial load
    this.filter$.next();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  private loadStats() {
    this.appService.getStats({
      agentId:  this.filterAgentId  || undefined,
      fromDate: this.filterFromDate || undefined,
      toDate:   this.filterToDate   || undefined,
    }).subscribe({
      next: res => this.stats.set(res.data),
      error: () => {},
    });
  }

  private syncUrl() {
    this._skipNextQp = true;
    const qp: Record<string, string | number | null> = {};
    if (this.filterStatus())  qp['status']   = this.filterStatus();
    if (this.filterAgentId)   qp['agentId']  = this.filterAgentId;
    if (this.filterFromDate)  qp['fromDate'] = this.filterFromDate;
    if (this.filterToDate)    qp['toDate']   = this.filterToDate;
    if (this.searchQuery)     qp['search']   = this.searchQuery;
    if (this.currentPage() > 0) qp['page']  = this.currentPage();
    this.router.navigate([], { queryParams: qp, replaceUrl: true });
  }

  onFilterChange() {
    this.currentPage.set(0);
    this.syncUrl();
    this.filter$.next();
  }

  goToPage(page: number) {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.syncUrl();
    this.filter$.next();
  }

  clearFilters() {
    this.filterStatus.set('');
    this.filterAgentId  = '';
    this.filterFromDate = '';
    this.filterToDate   = '';
    this.searchQuery    = '';
    this.currentPage.set(0);
    this.syncUrl();
    this.filter$.next();
  }

  hasActiveFilters(): boolean {
    return !!(this.filterStatus() || this.filterAgentId || this.filterFromDate || this.filterToDate || this.searchQuery);
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
        this.filter$.next();
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
        this.loadStats();
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

  get pages(): number[] {
    const total = this.totalPages();
    const cur = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(0, cur - delta); i <= Math.min(total - 1, cur + delta); i++) {
      range.push(i);
    }
    return range;
  }
}
