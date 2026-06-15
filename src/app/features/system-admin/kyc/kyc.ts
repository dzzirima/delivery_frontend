import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, KeyValuePipe } from '@angular/common';
import {
  KycService, KycSubmission, KycDocument,
  DocReview, RejectionCode, ViewUrlResponse,
} from './kyc.service';
import { ToastService } from '../../../core/toast.service';

type QueueTab = 'driver' | 'bike';

const REJECTION_CODES: RejectionCode[] = [
  'BLURRY', 'EXPIRED_DOC', 'WRONG_DOCUMENT', 'UNREADABLE', 'MISMATCH', 'INCOMPLETE', 'OTHER',
];

@Component({
  selector: 'app-admin-kyc',
  standalone: true,
  imports: [FormsModule, DatePipe, KeyValuePipe],
  templateUrl: './kyc.html',
})
export class AdminKyc implements OnInit {

  // ── Queue state ───────────────────────────────────────────────────────────
  activeTab     = signal<QueueTab>('driver');
  submissions   = signal<KycSubmission[]>([]);
  loadingQueue  = signal(false);
  totalElements = signal(0);
  totalPages    = signal(0);
  page          = signal(0);
  readonly size = 20;

  readonly rejectionCodes = REJECTION_CODES;

  // ── Review panel state ────────────────────────────────────────────────────
  selectedSubmission = signal<KycSubmission | null>(null);
  loadingSubmission  = signal(false);
  submitting         = signal(false);

  /** Per-document verdicts: documentId → DocReview draft */
  verdicts = signal<Record<string, DocReview>>({});

  allReviewed = computed(() => {
    const sub = this.selectedSubmission();
    if (!sub) return false;
    const v = this.verdicts();
    return sub.documents.every(d => v[d.id] !== undefined);
  });

  // ── View URL modal ────────────────────────────────────────────────────────
  viewUrlData    = signal<ViewUrlResponse | null>(null);
  loadingViewUrl = signal(false);
  viewUrlDocId   = signal<string | null>(null);

  constructor(
    private kycService: KycService,
    private toast:      ToastService,
  ) {}

  ngOnInit() { this.loadQueue(); }

  // ── Tab switch ─────────────────────────────────────────────────────────────

  switchTab(tab: QueueTab) {
    this.activeTab.set(tab);
    this.page.set(0);
    this.selectedSubmission.set(null);
    this.verdicts.set({});
    this.loadQueue();
  }

  // ── Queue ──────────────────────────────────────────────────────────────────

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
      error: () => { this.toast.error('Error', 'Failed to load queue.'); this.loadingQueue.set(false); },
    });
  }

  goToPage(p: number) {
    if (p < 0 || p >= this.totalPages()) return;
    this.page.set(p);
    this.loadQueue();
  }

  // ── Open submission for review ─────────────────────────────────────────────

  openSubmission(submissionId: string) {
    this.loadingSubmission.set(true);
    this.verdicts.set({});
    const call = this.activeTab() === 'driver'
      ? this.kycService.getDriverSubmission(submissionId)
      : this.kycService.getBikeSubmission(submissionId);

    call.subscribe({
      next: sub => {
        this.selectedSubmission.set(sub);
        // Pre-fill already-reviewed docs
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
      },
      error: () => { this.toast.error('Error', 'Failed to load submission.'); this.loadingSubmission.set(false); },
    });
  }

  closePanel() {
    this.selectedSubmission.set(null);
    this.verdicts.set({});
  }

  // ── Verdict setters ────────────────────────────────────────────────────────

  setApproved(doc: KycDocument) {
    this.verdicts.update(v => ({
      ...v,
      [doc.id]: { documentId: doc.id, approved: true },
    }));
  }

  setRejected(doc: KycDocument) {
    this.verdicts.update(v => ({
      ...v,
      [doc.id]: { documentId: doc.id, approved: false, rejectionCode: 'BLURRY' },
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

  // ── Submit review ──────────────────────────────────────────────────────────

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
        this.closePanel();
        this.loadQueue();
      },
      error: e => {
        this.toast.error('Error', e?.error?.message ?? 'Review failed.');
        this.submitting.set(false);
      },
    });
  }

  // ── View URL ───────────────────────────────────────────────────────────────

  openViewUrl(docId: string) {
    this.viewUrlDocId.set(docId);
    this.loadingViewUrl.set(true);
    this.viewUrlData.set(null);

    const call = this.activeTab() === 'driver'
      ? this.kycService.getDriverDocViewUrl(docId)
      : this.kycService.getBikeDocViewUrl(docId);

    call.subscribe({
      next: r => { this.viewUrlData.set(r); this.loadingViewUrl.set(false); },
      error: () => { this.toast.error('Error', 'Could not load document URL.'); this.loadingViewUrl.set(false); },
    });
  }

  closeViewUrl() {
    this.viewUrlData.set(null);
    this.viewUrlDocId.set(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  docStatusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING:  'bg-gray-100 text-gray-600',
      APPROVED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      EXPIRED:  'bg-orange-100 text-orange-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  submissionStatusClass(status: string): string {
    const map: Record<string, string> = {
      UNDER_REVIEW:       'bg-blue-100 text-blue-700',
      APPROVED:           'bg-green-100 text-green-700',
      PARTIALLY_REJECTED: 'bg-amber-100 text-amber-700',
      REJECTED:           'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  formatDocType(raw: string): string {
    return raw.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }
}
