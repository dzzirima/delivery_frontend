import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ── Enums ──────────────────────────────────────────────────────────────────────

export type KycStatus =
  | 'NOT_STARTED' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';

export type DocumentStatus =
  | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type RejectionCode =
  | 'BLURRY' | 'EXPIRED_DOC' | 'WRONG_DOCUMENT'
  | 'UNREADABLE' | 'MISMATCH' | 'INCOMPLETE' | 'OTHER';

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface DocViewDTO {
  id:              string;
  docType:         string;
  status:          DocumentStatus;
  rejectionCode:   RejectionCode | null;
  rejectionReason: string | null;
  versionCount:    number;
  uploadedAt:      string;
  reviewedAt:      string | null;
  viewUrl?:        string;
}

export interface DocVersionDTO {
  id:              string;
  versionNumber:   number;
  status:          DocumentStatus;
  rejectionCode:   RejectionCode | null;
  rejectionReason: string | null;
  reviewedById:    string | null;
  uploadedAt:      string;
  reviewedAt:      string | null;
  archivedAt:      string;
}

/** One row in the driver list (Level 1). */
export interface DriverKycListItem {
  profileId?:        string;
  driverId:          string;
  driverUserName:    string;
  driverEmail:       string;
  kycStatus:         KycStatus;
  approvedDocCount:  number;
  totalDocCount:     number;
  pendingReviewCount:number;
  lastActivityAt?:   string;
}

/** Full detail when admin clicks a driver (Level 2). */
export interface DriverKycDetail {
  profileId?:    string;
  driverId:      string;
  driverUserName:string;
  driverEmail:   string;
  kycStatus:     KycStatus;
  approvedAt?:   string;
  rejectedAt?:   string;
  documents:     DocViewDTO[];
}

export interface PageResponse<T> {
  content:       T[];
  totalElements: number;
  totalPages:    number;
  number:        number;
  size:          number;
}

export interface ViewUrlResponse {
  viewUrl:   string;
  expiresAt: string;
}

export interface DocRejectPayload {
  rejectionCode:   RejectionCode;
  rejectionReason?: string;
}

export interface ProfileOverridePayload {
  note?: string;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class KycService {

  private readonly base = `${environment.apiUrl}/kyc/admin`;

  constructor(private http: HttpClient) {}

  // ── Level 1: driver list ──────────────────────────────────────────────────

  listDrivers(page = 0, size = 20, status?: KycStatus, search?: string): Observable<PageResponse<DriverKycListItem>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<PageResponse<DriverKycListItem>>(`${this.base}/drivers`, { params });
  }

  // ── Level 2: driver detail ────────────────────────────────────────────────

  getDriverDetail(driverId: string): Observable<DriverKycDetail> {
    return this.http.get<DriverKycDetail>(`${this.base}/drivers/${driverId}`);
  }

  // ── Level 3: version history ──────────────────────────────────────────────

  getDocVersionHistory(documentId: string): Observable<DocVersionDTO[]> {
    return this.http.get<DocVersionDTO[]>(`${this.base}/documents/${documentId}/versions`);
  }

  // ── Document view URL ─────────────────────────────────────────────────────

  getDocViewUrl(documentId: string): Observable<ViewUrlResponse> {
    return this.http.get<ViewUrlResponse>(`${this.base}/documents/${documentId}/view-url`);
  }

  /** Signed view URL for an archived driver document version (admin only). */
  getDocVersionViewUrl(versionId: string): Observable<ViewUrlResponse> {
    return this.http.get<ViewUrlResponse>(`${this.base}/document-versions/${versionId}/view-url`);
  }

  /** Signed view URL for an archived bike document version (admin only). */
  getBikeDocVersionViewUrl(versionId: string): Observable<ViewUrlResponse> {
    return this.http.get<ViewUrlResponse>(`${this.base}/bike-document-versions/${versionId}/view-url`);
  }

  // ── Per-document verdicts ─────────────────────────────────────────────────

  approveDocument(documentId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/documents/${documentId}/approve`, {});
  }

  rejectDocument(documentId: string, payload: DocRejectPayload): Observable<void> {
    return this.http.post<void>(`${this.base}/documents/${documentId}/reject`, payload);
  }

  // ── Profile overrides ─────────────────────────────────────────────────────

  forceApproveProfile(driverId: string, payload?: ProfileOverridePayload): Observable<void> {
    return this.http.post<void>(`${this.base}/drivers/${driverId}/profile/approve`, payload ?? {});
  }

  forceRejectProfile(driverId: string, payload?: ProfileOverridePayload): Observable<void> {
    return this.http.post<void>(`${this.base}/drivers/${driverId}/profile/reject`, payload ?? {});
  }
}
