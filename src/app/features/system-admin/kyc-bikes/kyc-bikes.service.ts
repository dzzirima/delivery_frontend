import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  KycStatus, DocumentStatus, RejectionCode,
  DocVersionDTO, PageResponse, ViewUrlResponse,
  DocRejectPayload, ProfileOverridePayload,
} from '../kyc/kyc.service';

// Re-export shared types so consumers only need one import
export type {
  KycStatus, DocumentStatus, RejectionCode,
  DocVersionDTO, PageResponse, ViewUrlResponse,
  DocRejectPayload, ProfileOverridePayload,
};

// ── Bike-specific DTOs ─────────────────────────────────────────────────────────

/** One document slot on a bike KYC profile. */
export interface BikeDocViewDTO {
  id:              string;
  docType:         string;
  status:          DocumentStatus;
  rejectionCode:   RejectionCode | null;
  rejectionReason: string | null;
  versionCount:    number;
  uploadedAt:      string;
  reviewedAt:      string | null;
}

/** One row in the bike list (Level 1). */
export interface BikeKycListItem {
  profileId?:         string;
  bikeId:             string;
  licensePlate:       string;
  make:               string;
  bikeModel:          string;
  ownerName:          string;
  ownerEmail:         string;
  kycStatus:          KycStatus;
  approvedDocCount:   number;
  totalDocCount:      number;
  pendingReviewCount: number;
  lastActivityAt?:    string;
}

/** Full bike KYC detail when admin selects a bike (Level 2). */
export interface BikeKycDetail {
  profileId?:   string;
  bikeId:       string;
  licensePlate: string;
  make:         string;
  bikeModel:    string;
  ownerName:    string;
  ownerEmail:   string;
  kycStatus:    KycStatus;
  approvedAt?:  string;
  rejectedAt?:  string;
  documents:    BikeDocViewDTO[];
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class KycBikesService {

  private readonly base = `${environment.apiUrl}/kyc/admin`;

  constructor(private http: HttpClient) {}

  // ── Level 1: bike list ────────────────────────────────────────────────────

  listBikes(page = 0, size = 20, status?: KycStatus, search?: string): Observable<PageResponse<BikeKycListItem>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<PageResponse<BikeKycListItem>>(`${this.base}/bikes`, { params });
  }

  // ── Level 2: bike detail ──────────────────────────────────────────────────

  getBikeDetail(bikeId: string): Observable<BikeKycDetail> {
    return this.http.get<BikeKycDetail>(`${this.base}/bikes/${bikeId}`);
  }

  // ── Level 3: document version history ────────────────────────────────────

  getBikeDocVersionHistory(documentId: string): Observable<DocVersionDTO[]> {
    return this.http.get<DocVersionDTO[]>(`${this.base}/bike-documents/${documentId}/versions`);
  }

  // ── View URLs ─────────────────────────────────────────────────────────────

  getBikeDocViewUrl(documentId: string): Observable<ViewUrlResponse> {
    return this.http.get<ViewUrlResponse>(`${this.base}/bike-documents/${documentId}/view-url`);
  }

  getBikeDocVersionViewUrl(versionId: string): Observable<ViewUrlResponse> {
    return this.http.get<ViewUrlResponse>(`${this.base}/bike-document-versions/${versionId}/view-url`);
  }

  // ── Per-document verdicts ─────────────────────────────────────────────────

  approveBikeDocument(documentId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/bike-documents/${documentId}/approve`, {});
  }

  rejectBikeDocument(documentId: string, payload: DocRejectPayload): Observable<void> {
    return this.http.post<void>(`${this.base}/bike-documents/${documentId}/reject`, payload);
  }

  // ── Profile overrides ─────────────────────────────────────────────────────

  forceApproveBikeProfile(bikeId: string, payload?: ProfileOverridePayload): Observable<void> {
    return this.http.post<void>(`${this.base}/bikes/${bikeId}/profile/approve`, payload ?? {});
  }

  forceRejectBikeProfile(bikeId: string, payload?: ProfileOverridePayload): Observable<void> {
    return this.http.post<void>(`${this.base}/bikes/${bikeId}/profile/reject`, payload ?? {});
  }
}
