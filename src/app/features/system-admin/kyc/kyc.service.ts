import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// ── Shared types ───────────────────────────────────────────────────────────────

export type KycStatus =
  | 'NOT_STARTED' | 'UNDER_REVIEW' | 'IN_PROGRESS'
  | 'APPROVED' | 'PARTIALLY_REJECTED' | 'REJECTED' | 'EXPIRED';

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type RejectionCode =
  | 'BLURRY' | 'EXPIRED_DOC' | 'WRONG_DOCUMENT'
  | 'UNREADABLE' | 'MISMATCH' | 'INCOMPLETE' | 'OTHER';

export interface KycDocument {
  id:              string;
  submissionId:    string;
  docType:         string;
  status:          DocumentStatus;
  rejectionCode:   RejectionCode | null;
  rejectionReason: string | null;
  expiresAt:       string | null;
  uploadedAt:      string;
  reviewedAt:      string | null;
}

export interface KycSubmission {
  id:          string;
  profileId:   string;
  version:     number;
  status:      KycStatus;
  submittedAt: string;
  reviewedAt:  string | null;
  reviewerId:  string | null;
  createdAt:   string;
  documents:   KycDocument[];
}

export interface PageResponse<T> {
  content:       T[];
  totalElements: number;
  totalPages:    number;
  number:        number;
  size:          number;
}

export interface DocReview {
  documentId:      string;
  approved:        boolean;
  rejectionCode?:  RejectionCode;
  rejectionReason?: string;
}

export interface ViewUrlResponse {
  viewUrl:   string;
  expiresAt: string;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class KycService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  // ── Driver queues ─────────────────────────────────────────────────────────

  getDriverQueue(page = 0, size = 20) {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<{ content: KycSubmission[]; totalElements: number; totalPages: number }>(
      `${this.base}/kyc/driver/queue`, { params });
  }

  getDriverSubmission(submissionId: string) {
    return this.http.get<KycSubmission>(
      `${this.base}/kyc/driver/submissions/${submissionId}`);
  }

  reviewDriverSubmission(submissionId: string, reviews: DocReview[]) {
    return this.http.post<void>(
      `${this.base}/kyc/admin/driver/submissions/${submissionId}/review`,
      { documentReviews: reviews });
  }

  getDriverDocViewUrl(documentId: string) {
    return this.http.get<ViewUrlResponse>(
      `${this.base}/kyc/driver/documents/${documentId}/view-url/admin`);
  }

  // ── Bike queues ───────────────────────────────────────────────────────────

  getBikeQueue(page = 0, size = 20) {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<{ content: KycSubmission[]; totalElements: number; totalPages: number }>(
      `${this.base}/kyc/bike/queue`, { params });
  }

  getBikeSubmission(submissionId: string) {
    return this.http.get<KycSubmission>(
      `${this.base}/kyc/bike/submissions/${submissionId}`);
  }

  reviewBikeSubmission(submissionId: string, reviews: DocReview[]) {
    return this.http.post<void>(
      `${this.base}/kyc/admin/bike/submissions/${submissionId}/review`,
      { documentReviews: reviews });
  }

  getBikeDocViewUrl(documentId: string) {
    return this.http.get<ViewUrlResponse>(
      `${this.base}/kyc/bike/documents/${documentId}/view-url/admin`);
  }
}
