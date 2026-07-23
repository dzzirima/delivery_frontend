import { Component, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, NgIf, NgFor, DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  KycBikesService,
  BikeKycListItem, BikeKycDetail, BikeDocViewDTO,
  DocVersionDTO, KycStatus, RejectionCode, DocRejectPayload,
} from './kyc-bikes.service';
import { ToastService } from '../../../core/toast.service';
import { REJECTION_CODES, KYC_STATUS_LABELS } from '../kyc/kyc';

type ImageState = { loading: boolean; url: string | null; error: boolean };

@Component({
  selector:    'app-admin-kyc-bikes',
  standalone:  true,
  imports:     [FormsModule, NgClass, NgIf, NgFor, DatePipe],
  templateUrl: './kyc-bikes.html',
  styleUrl:    './kyc-bikes.css',
})
export class AdminKycBikes implements OnInit {

  readonly rejectionCodes = REJECTION_CODES;
  readonly statusLabels   = KYC_STATUS_LABELS;

  // ── Level 1: Bike list ────────────────────────────────────────────────────
  bikes         = signal<BikeKycListItem[]>([]);
  listLoading   = signal(false);
  listError     = signal<string | null>(null);
  totalElements = signal(0);
  totalPages    = signal(0);
  page          = signal(0);
  statusFilter  = signal<KycStatus | ''>('');
  searchQuery   = signal('');
  readonly pageSize = 20;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Level 2: Bike detail ──────────────────────────────────────────────────
  selectedBike  = signal<BikeKycDetail | null>(null);
  detailLoading = signal(false);

  docImages       = signal<Record<string, ImageState>>({});
  rejectingDocId  = signal<string | null>(null);
  rejectCode      = signal<RejectionCode | ''>('');
  rejectReason    = signal('');
  submittingDoc   = signal(false);

  // ── Level 3: Version history ──────────────────────────────────────────────
  versionDocId    = signal<string | null>(null);
  versions        = signal<DocVersionDTO[]>([]);
  versionsLoading = signal(false);
  versionImages   = signal<Record<string, ImageState>>({});

  // ── Lightbox ──────────────────────────────────────────────────────────────
  lightboxUrl   = signal<string | null>(null);
  lightboxLabel = signal('');

  openLightbox(url: string, label: string): void {
    this.lightboxUrl.set(url);
    this.lightboxLabel.set(label);
  }
  closeLightbox(): void { this.lightboxUrl.set(null); }

  // ── Profile override ──────────────────────────────────────────────────────
  overrideMode       = signal<'approve' | 'reject' | null>(null);
  overrideNote       = signal('');
  submittingOverride = signal(false);

  private destroyRef = inject(DestroyRef);

  constructor(
    private svc:    KycBikesService,
    private toast:  ToastService,
    private router: Router,
    private route:  ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadBikes();

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const bikeId = params.get('bikeId');
        if (bikeId) {
          this.selectBike(bikeId);
        } else {
          this.selectedBike.set(null);
          this.detailLoading.set(false);
        }
      });
  }

  // ── Level 1 actions ───────────────────────────────────────────────────────

  loadBikes(p = 0): void {
    this.listLoading.set(true);
    this.listError.set(null);
    const status = this.statusFilter() || undefined;
    const search = this.searchQuery().trim() || undefined;
    this.svc.listBikes(p, this.pageSize, status as KycStatus | undefined, search).subscribe({
      next: res => {
        this.bikes.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
        this.page.set(p);
        this.listLoading.set(false);
      },
      error: () => {
        this.listError.set('Failed to load bikes.');
        this.listLoading.set(false);
      },
    });
  }

  onFilterChange(): void { this.loadBikes(0); }
  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadBikes(0), 350);
  }
  prevPage(): void { if (this.page() > 0) this.loadBikes(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages() - 1) this.loadBikes(this.page() + 1); }

  // ── Level 2 actions ───────────────────────────────────────────────────────

  selectBike(bikeId: string): void {
    this.detailLoading.set(true);
    this.selectedBike.set(null);
    this.docImages.set({});
    this.versionDocId.set(null);
    this.rejectingDocId.set(null);

    this.svc.getBikeDetail(bikeId).subscribe({
      next: detail => {
        this.selectedBike.set(detail);
        this.detailLoading.set(false);
        this.preloadDocImages(detail.documents);
        this.patchBikeInList(detail);
      },
      error: () => {
        this.toast.error('Failed to load bike KYC details.');
        this.detailLoading.set(false);
      },
    });
  }

  private patchBikeInList(detail: BikeKycDetail): void {
    this.bikes.update(list =>
      list.map(b => b.bikeId !== detail.bikeId ? b : {
        ...b,
        kycStatus:          detail.kycStatus,
        approvedDocCount:   detail.documents.filter(doc => doc.status === 'APPROVED').length,
        totalDocCount:      detail.documents.length,
        pendingReviewCount: detail.documents.filter(doc => doc.status === 'UNDER_REVIEW').length,
      })
    );
  }

  navigateToBike(bikeId: string): void {
    this.router.navigate(['/admin/kyc-bikes/bike', bikeId]);
  }

  closeDetail(): void {
    this.router.navigate(['/admin/kyc-bikes']);
  }

  private preloadDocImages(docs: BikeDocViewDTO[]): void {
    const initial: Record<string, ImageState> = {};
    for (const doc of docs) initial[doc.id] = { loading: true, url: null, error: false };
    this.docImages.set(initial);

    for (const doc of docs) {
      this.svc.getBikeDocViewUrl(doc.id)
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

  approveDoc(doc: BikeDocViewDTO): void {
    this.submittingDoc.set(true);
    this.svc.approveBikeDocument(doc.id).subscribe({
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

  startReject(doc: BikeDocViewDTO): void {
    this.rejectingDocId.set(doc.id);
    this.rejectCode.set('');
    this.rejectReason.set('');
  }

  cancelReject(): void { this.rejectingDocId.set(null); }

  submitReject(doc: BikeDocViewDTO): void {
    if (!this.rejectCode()) {
      this.toast.error('Please select a rejection reason.');
      return;
    }
    const payload: DocRejectPayload = {
      rejectionCode:   this.rejectCode() as RejectionCode,
      rejectionReason: this.rejectReason() || undefined,
    };
    this.submittingDoc.set(true);
    this.svc.rejectBikeDocument(doc.id, payload).subscribe({
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
    this.svc.getBikeDocVersionHistory(docId).subscribe({
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
    const initial: Record<string, ImageState> = {};
    for (const v of versions) initial[v.id] = { loading: true, url: null, error: false };
    this.versionImages.set(initial);

    for (const v of versions) {
      this.svc.getBikeDocVersionViewUrl(v.id)
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

  cancelOverride(): void { this.overrideMode.set(null); }

  submitOverride(): void {
    const bike = this.selectedBike();
    if (!bike) return;
    this.submittingOverride.set(true);
    const note    = this.overrideNote() || undefined;
    const request = this.overrideMode() === 'approve'
      ? this.svc.forceApproveBikeProfile(bike.bikeId, { note })
      : this.svc.forceRejectBikeProfile(bike.bikeId, { note });

    request.subscribe({
      next: () => {
        const label = this.overrideMode() === 'approve' ? 'approved' : 'rejected';
        this.toast.success(`Bike KYC profile ${label}.`);
        this.overrideMode.set(null);
        this.submittingOverride.set(false);
        this.refreshDetail();
        this.loadBikes(this.page());
      },
      error: () => {
        this.toast.error('Failed to update bike profile.');
        this.submittingOverride.set(false);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  refreshDetail(): void {
    const bike = this.selectedBike();
    if (bike) this.selectBike(bike.bikeId);
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
