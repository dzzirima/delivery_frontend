import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  KycService, KycSubmission, KycDocument,
  DocReview, RejectionCode, ViewUrlResponse,
} from './kyc.service';
import { ToastService } from '../../../core/toast.service';

type QueueTab = 'driver' | 'bike';

const REJECTION_CODES: { code: RejectionCode; label: string }[] = [
  { code: 'BLURRY',         label: 'Image is blurry'       },
  { code: 'EXPIRED_DOC',    label: 'Document is expired'   },
  { code: 'WRONG_DOCUMENT', label: 'Wrong document type'   },
  { code: 'UNREADABLE',     label: 'Document is unreadable'},
  { code: 'MISMATCH',       label: 'Information mismatch'  },
  { code: 'INCOMPLETE',     label: 'Incomplete document'   },
  { code: 'OTHER',          label: 'Other reason'          },
];

// Doc types that form the driver identity grid rows
const DRIVER_IDENTITY_ROW  = ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'SELFIE'];
const DRIVER_LICENSE_ROW   = ['DRIVERS_LICENSE_FRONT', 'DRIVERS_LICENSE_BACK'];

export interface DocImageState {
  loading: boolean;
  url:     string | null;
  error:   boolean;
}

@Component({
  selector:    'app-admin-kyc',
  standalone:  true,
  imports:     [FormsModule, NgTemplateOutlet],
  templateUrl: './kyc.html',
  styleUrl:    './kyc.css',
})
export class AdminKyc implements OnInit {

  // ── Queue ─────────────────────────────────────────────────────────────────
  activeTab     = signal<QueueTab>('driver');
  submissions   = signal<KycSubmission[]>([]);
  loadingQueue  = signal(false);
  totalElements = signal(0);
  totalPages    = signal(0);
  page          = signal(0);
  readonly size = 20;

  readonly rejectionCodes = REJECTION_CODES;

  // ── Review panel ──────────────────────────────────────────────────────────
  selectedSubmission = signal<KycSubmission | null>(null);
  loadingSubmission  = signal(false);
  submitting         = signal(false);

  /** Per-document verdicts keyed by documentId */
  verdicts = signal<Record<string, DocReview>>({});

  /** Inline image states keyed by documentId */
  docImages = signal<Record<string, DocImageState>>({});

  allReviewed = computed(() => {
    const sub = this.selectedSubmission();
    if (!sub) return false;
    const v = this.verdicts();
    return sub.documents.every(d => v[d.id] !== undefined);
  });

  /** Driver submissions: group documents into visual rows */
  identityRow = computed<KycDocument[]>(() => {
    const sub = this.selectedSubmission();
    if (!sub || this.activeTab() !== 'driver') return [];
    return DRIVER_IDENTITY_ROW
      .map(t => sub.documents.find(d => d.docType === t))
      .filter((d): d is KycDocument => !!d);
  });

  licenseRow = computed<KycDocument[]>(() => {
    const sub = this.selectedSubmission();
    if (!sub || this.activeTab() !== 'driver') return [];
    return DRIVER_LICENSE_ROW
      .map(t => sub.documents.find(d => d.docType === t))
      .filter((d): d is KycDocument => !!d);
  });

  /** Bike / fallback: all docs in order */
  allDocs = computed<KycDocument[]>(() => {
    return this.selectedSubmission()?.documents ?? [];
  });

  constructor(
    private kycService: KycService,
    private toast:      ToastService,
  ) {}

  ngOnInit() { this.loadQueue(); }

  // ── Tab ───────────────────────────────────────────────────────────────────

  switchTab(tab: QueueTab) {
    this.activeTab.set(tab);
    this.page.set(0);
    this.selectedSubmission.set(null);
    this.verdicts.set({});
    this.docImages.set({});
    this.loadQueue();
  }

  // ── Queue ─────────────────────────────────────────────────────────────────

  loadQueue() {
    this.loadingQueue.set(true);
    const call = this.activeTab() === 'driver'
      ? this.kycService.getDriverQueue(this.page(), this.size)
      : this.kycService.getBikeQueue(this.page(), this.size);

    call.subscribe({
      next: r => {
        this.submissions.set(r.content);
        this.totalElements.set(r.totalElements);
        this.totalPages.set(r.totalPages);
        this.loadingQueue.set(false);
      },
      error: () => {
        this.toast.error('Error', 'Failed to load queue.');
        this.loadingQueue.set(false);
      },
    });
  }

  goToPage(p: number) {
    if (p < 0 || p >= this.totalPages()) return;
    this.page.set(p);
    this.loadQueue();
  }

  // ── Open submission ───────────────────────────────────────────────────────

  openSubmission(submissionId: string) {
    this.loadingSubmission.set(true);
    this.verdicts.set({});
    this.docImages.set({});

    const call = this.activeTab() === 'driver'
      ? this.kycService.getDriverSubmission(submissionId)
      : this.kycService.getBikeSubmission(submissionId);

    call.subscribe({
      next: sub => {
        this.selectedSubmission.set(sub);

        // Pre-fill any already-reviewed verdicts
        const v: Record<string, DocReview> = {};
        for (const doc of sub.documents) {
          if (doc.status === 'APPROVED') {
            v[doc.id] = { documentId: doc.id, approved: true };
          } else if (doc.status === 'REJECTED') {
            v[doc.id] = {
              documentId:      doc.id,
              approved:        false,
              rejectionCode:   doc.rejectionCode ?? undefined,
              rejectionReason: doc.rejectionReason ?? undefined,
            };
          }
        }
        this.verdicts.set(v);
        this.loadingSubmission.set(false);

        // Parallel-fetch all document view URLs
        this._preloadImages(sub);
      },
      error: () => {
        this.toast.error('Error', 'Failed to load submission.');
        this.loadingSubmission.set(false);
      },
    });
  }

  private _preloadImages(sub: KycSubmission) {
    // Mark all as loading
    const initial: Record<string, DocImageState> = {};
    for (const doc of sub.documents) {
      initial[doc.id] = { loading: true, url: null, error: false };
    }
    this.docImages.set(initial);

    // Fire all view-URL requests in parallel
    const calls = sub.documents.map(doc => {
      const req = this.activeTab() === 'driver'
        ? this.kycService.getDriverDocViewUrl(doc.id)
        : this.kycService.getBikeDocViewUrl(doc.id);
      return req.pipe(catchError(() => of(null)));
    });

    forkJoin(calls).subscribe(results => {
      const updated: Record<string, DocImageState> = {};
      sub.documents.forEach((doc, i) => {
        const res = results[i] as ViewUrlResponse | null;
        updated[doc.id] = {
          loading: false,
          url:     res?.viewUrl ?? null,
          error:   res === null,
        };
      });
      this.docImages.set(updated);
    });
  }

  closePanel() {
    this.selectedSubmission.set(null);
    this.verdicts.set({});
    this.docImages.set({});
  }

  // ── Verdicts ──────────────────────────────────────────────────────────────

  setApproved(doc: KycDocument) {
    this.verdicts.update(v => ({
      ...v,
      [doc.id]: { documentId: doc.id, approved: true },
    }));
  }

  setRejected(doc: KycDocument) {
    this.verdicts.update(v => ({
      ...v,
      [doc.id]: {
        documentId:    doc.id,
        approved:      false,
        rejectionCode: 'BLURRY',
      },
    }));
  }

  setRejectionCode(docId: string, code: RejectionCode) {
    this.verdicts.update(v => ({
      ...v,
      [docId]: { ...v[docId], rejectionCode: code },
    }));
  }

  setRejectionReason(docId: string, reason: string) {
    this.verdicts.update(v => ({
      ...v,
      [docId]: { ...v[docId], rejectionReason: reason },
    }));
  }

  getVerdict(docId: string): DocReview | undefined {
    return this.verdicts()[docId];
  }

  getImage(docId: string): DocImageState {
    return this.docImages()[docId] ?? { loading: false, url: null, error: false };
  }

  // ── Submit review with local eviction ─────────────────────────────────────

  submitReview() {
    const sub = this.selectedSubmission();
    if (!sub || !this.allReviewed()) return;

    const reviews = Object.values(this.verdicts());
    this.submitting.set(true);

    const call = this.activeTab() === 'driver'
      ? this.kycService.reviewDriverSubmission(sub.id, reviews)
      : this.kycService.reviewBikeSubmission(sub.id, reviews);

    call.subscribe({
      next: () => {
        this.toast.success('Done', 'Submission reviewed successfully.');
        this.submitting.set(false);

        // Evict from local queue and auto-advance
        const list    = this.submissions();
        const idx     = list.findIndex(s => s.id === sub.id);
        const newList = list.filter(s => s.id !== sub.id);
        this.submissions.set(newList);
        this.totalElements.update(n => Math.max(0, n - 1));

        if (newList.length > 0) {
          const nextIdx = Math.min(idx, newList.length - 1);
          this.openSubmission(newList[nextIdx].id);
        } else {
          this.closePanel();
        }
      },
      error: e => {
        this.toast.error('Error', e?.error?.message ?? 'Review failed.');
        this.submitting.set(false);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatDocType(raw: string): string {
    return raw.replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs  < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  pendingCount(): number {
    const sub = this.selectedSubmission();
    if (!sub) return 0;
    return sub.documents.length - Object.keys(this.verdicts()).length;
  }
}
