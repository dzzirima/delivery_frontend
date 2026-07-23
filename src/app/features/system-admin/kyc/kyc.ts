import { Component, OnInit, signal, computed, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, NgIf, NgFor, DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  KycService,
  DriverKycListItem, DriverKycDetail,
  DocViewDTO, DocVersionDTO,
  KycStatus, RejectionCode,
  DocRejectPayload,
} from './kyc.service';
import { ToastService } from '../../../core/toast.service';

export const REJECTION_CODES: { code: RejectionCode; label: string }[] = [
  { code: 'BLURRY',         label: 'Image is blurry'        },
  { code: 'EXPIRED_DOC',    label: 'Document is expired'    },
  { code: 'WRONG_DOCUMENT', label: 'Wrong document type'    },
  { code: 'UNREADABLE',     label: 'Document is unreadable' },
  { code: 'MISMATCH',       label: 'Information mismatch'   },
  { code: 'INCOMPLETE',     label: 'Incomplete document'    },
  { code: 'OTHER',          label: 'Other reason'           },
];

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  APPROVED:    'Approved',
  REJECTED:    'Rejected',
};

@Component({
  selector:    'app-admin-kyc',
  standalone:  true,
  imports:     [FormsModule, NgClass, NgIf, NgFor, DatePipe],
  templateUrl: './kyc.html',
  styleUrl:    './kyc.css',
})
export class AdminKyc implements OnInit {

  readonly rejectionCodes = REJECTION_CODES;
  readonly statusLabels   = KYC_STATUS_LABELS;

  // ── Level 1: Driver list ──────────────────────────────────────────────────
  drivers       = signal<DriverKycListItem[]>([]);
  listLoading   = signal(false);
  listError     = signal<string | null>(null);
  totalElements = signal(0);
  totalPages    = signal(0);
  page          = signal(0);
  statusFilter  = signal<KycStatus | ''>('');
  searchQuery   = signal('');
  readonly pageSize = 20;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Level 2: Driver detail ────────────────────────────────────────────────
  selectedDriver  = signal<DriverKycDetail | null>(null);
  detailLoading   = signal(false);

  // Per-document image state
  docImages = signal<Record<string, { loading: boolean; url: string | null; error: boolean }>>({});

  // Per-document reject form state
  rejectingDocId  = signal<string | null>(null);
  rejectCode      = signal<RejectionCode | ''>('');
  rejectReason    = signal('');
  submittingDoc   = signal(false);

  // ── Level 3: Version history ──────────────────────────────────────────────
  versionDocId    = signal<string | null>(null);
  versions        = signal<DocVersionDTO[]>([]);
  versionsLoading = signal(false);

  // Per-version image state (admin only — archived versions)
  versionImages = signal<Record<string, { loading: boolean; url: string | null; error: boolean }>>({});

  // ── Image lightbox ────────────────────────────────────────────────────────
  lightboxUrl   = signal<string | null>(null);
  lightboxLabel = signal<string>('');

  openLightbox(url: string, label: string): void {
    this.lightboxUrl.set(url);
    this.lightboxLabel.set(label);
  }

  closeLightbox(): void {
    this.lightboxUrl.set(null);
  }

  // ── Profile override modal ─────────────────────────────────────────────────
  overrideMode    = signal<'approve' | 'reject' | null>(null);
  overrideNote    = signal('');
  submittingOverride = signal(false);

  private destroyRef = inject(DestroyRef);

  constructor(
    private kycService: KycService,
    private toast:      ToastService,
    private router:     Router,
    private route:      ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadDrivers();

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const driverId = params.get('driverId');
        if (driverId) {
          this.selectDriver(driverId);
        } else {
          this.selectedDriver.set(null);
          this.detailLoading.set(false);
        }
      });
  }

  // ── Level 1 actions ───────────────────────────────────────────────────────

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadDrivers(0), 350);
  }

  loadDrivers(p = 0): void {
    this.listLoading.set(true);
    this.listError.set(null);

    const status = this.statusFilter() || undefined;
    const search = this.searchQuery().trim() || undefined;
    this.kycService.listDrivers(p, this.pageSize, status as KycStatus | undefined, search)
      .subscribe({
        next: res => {
          this.drivers.set(res.content);
          this.totalElements.set(res.totalElements);
          this.totalPages.set(res.totalPages);
          this.page.set(p);
          this.listLoading.set(false);
        },
        error: () => {
          this.listError.set('Failed to load drivers.');
          this.listLoading.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.loadDrivers(0);
  }

  prevPage(): void { if (this.page() > 0) this.loadDrivers(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages() - 1) this.loadDrivers(this.page() + 1); }

  // ── Level 2 actions ───────────────────────────────────────────────────────

  selectDriver(driverId: string): void {
    this.detailLoading.set(true);
    this.selectedDriver.set(null);
    this.docImages.set({});
    this.versionDocId.set(null);
    this.rejectingDocId.set(null);

    this.kycService.getDriverDetail(driverId).subscribe({
      next: detail => {
        this.selectedDriver.set(detail);
        this.detailLoading.set(false);
        this.preloadDocImages(detail.documents);
        this.patchDriverInList(detail);
      },
      error: () => {
        this.toast.error('Failed to load driver KYC details.');
        this.detailLoading.set(false);
      },
    });
  }

  private patchDriverInList(detail: DriverKycDetail): void {
    this.drivers.update(list =>
      list.map(d => d.driverId !== detail.driverId ? d : {
        ...d,
        kycStatus:          detail.kycStatus,
        approvedDocCount:   detail.documents.filter(doc => doc.status === 'APPROVED').length,
        totalDocCount:      detail.documents.length,
        pendingReviewCount: detail.documents.filter(doc => doc.status === 'UNDER_REVIEW').length,
      })
    );
  }

  navigateToDriver(driverId: string): void {
    this.router.navigate(['/admin/kyc/driver', driverId]);
  }

  closeDetail(): void {
    this.router.navigate(['/admin/kyc']);
  }

  private preloadDocImages(docs: DocViewDTO[]): void {
    // Mark all docs as loading up front in one signal write
    const initial: Record<string, { loading: boolean; url: string | null; error: boolean }> = {};
    for (const doc of docs) {
      initial[doc.id] = { loading: true, url: null, error: false };
    }
    this.docImages.set(initial);

    // Fetch each URL and update the signal immutably so Angular detects the change
    for (const doc of docs) {
      this.kycService.getDocViewUrl(doc.id)
        .pipe(catchError(() => of(null)))
        .subscribe(res => {
          this.docImages.update(map => ({
            ...map,
            [doc.id]: { loading: false, url: res?.viewUrl ?? null, error: !res },
          }));
        });
    }
  }

  // ── Per-document verdicts ─────────────────────────────────────────────────

  approveDoc(doc: DocViewDTO): void {
    this.submittingDoc.set(true);
    this.kycService.approveDocument(doc.id).subscribe({
      next: () => {
        this.toast.success(`${this.formatDocType(doc.docType)} approved.`);
        this.submittingDoc.set(false);
        this.refreshDetail();
      },
      error: () => {
        this.toast.error('Failed to approve document.');
        this.submittingDoc.set(false);
      },
    });
  }

  startReject(doc: DocViewDTO): void {
    this.rejectingDocId.set(doc.id);
    this.rejectCode.set('');
    this.rejectReason.set('');
  }

  cancelReject(): void {
    this.rejectingDocId.set(null);
  }

  submitReject(doc: DocViewDTO): void {
    if (!this.rejectCode()) {
      this.toast.error('Please select a rejection reason.');
      return;
    }
    const payload: DocRejectPayload = {
      rejectionCode:   this.rejectCode() as RejectionCode,
      rejectionReason: this.rejectReason() || undefined,
    };
    this.submittingDoc.set(true);
    this.kycService.rejectDocument(doc.id, payload).subscribe({
      next: () => {
        this.toast.success(`${this.formatDocType(doc.docType)} rejected.`);
        this.rejectingDocId.set(null);
        this.submittingDoc.set(false);
        this.refreshDetail();
      },
      error: () => {
        this.toast.error('Failed to reject document.');
        this.submittingDoc.set(false);
      },
    });
  }

  // ── Level 3: Version history ──────────────────────────────────────────────

  loadVersions(docId: string): void {
    this.versionDocId.set(docId);
    this.versionsLoading.set(true);
    this.versionImages.set({});
    this.kycService.getDocVersionHistory(docId).subscribe({
      next: versions => {
        this.versions.set(versions);
        this.versionsLoading.set(false);
        this.preloadVersionImages(versions);
      },
      error: () => {
        this.toast.error('Failed to load version history.');
        this.versionsLoading.set(false);
      },
    });
  }

  private preloadVersionImages(versions: DocVersionDTO[]): void {
    const initial: Record<string, { loading: boolean; url: string | null; error: boolean }> = {};
    for (const v of versions) {
      initial[v.id] = { loading: true, url: null, error: false };
    }
    this.versionImages.set(initial);

    for (const v of versions) {
      this.kycService.getDocVersionViewUrl(v.id)
        .pipe(catchError(() => of(null)))
        .subscribe(res => {
          this.versionImages.update(map => ({
            ...map,
            [v.id]: { loading: false, url: res?.viewUrl ?? null, error: !res },
          }));
        });
    }
  }

  closeVersions(): void {
    this.versionDocId.set(null);
    this.versionImages.set({});
  }

  // ── Profile override ──────────────────────────────────────────────────────

  openOverride(mode: 'approve' | 'reject'): void {
    this.overrideMode.set(mode);
    this.overrideNote.set('');
  }

  cancelOverride(): void {
    this.overrideMode.set(null);
  }

  submitOverride(): void {
    const driver = this.selectedDriver();
    if (!driver) return;

    this.submittingOverride.set(true);
    const note    = this.overrideNote() || undefined;
    const request = this.overrideMode() === 'approve'
      ? this.kycService.forceApproveProfile(driver.driverId, { note })
      : this.kycService.forceRejectProfile(driver.driverId, { note });

    request.subscribe({
      next: () => {
        const label = this.overrideMode() === 'approve' ? 'approved' : 'rejected';
        this.toast.success(`Driver KYC profile ${label}.`);
        this.overrideMode.set(null);
        this.submittingOverride.set(false);
        this.refreshDetail();
        this.loadDrivers(this.page());
      },
      error: () => {
        this.toast.error('Failed to update profile.');
        this.submittingOverride.set(false);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  refreshDetail(): void {
    const driver = this.selectedDriver();
    if (driver) this.selectDriver(driver.driverId);
  }

  formatDocType(raw: string): string {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  statusClass(status: KycStatus): string {
    return {
      NOT_STARTED: 'status-not-started',
      IN_PROGRESS: 'status-in-progress',
      APPROVED:    'status-approved',
      REJECTED:    'status-rejected',
    }[status] ?? '';
  }

  docStatusClass(status: string): string {
    return {
      UNDER_REVIEW: 'doc-under-review',
      APPROVED:     'doc-approved',
      REJECTED:     'doc-rejected',
      EXPIRED:      'doc-expired',
    }[status] ?? '';
  }
}
