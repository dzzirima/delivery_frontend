import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ── Role constants ─────────────────────────────────────────────────────────────
export type UserRole =
  | 'ADMIN'
  | 'ORG_ADMIN'
  | 'DISPATCHER'
  | 'RIDER'
  | 'CUSTOMER';

// Roles that are allowed to access this web dashboard
export const WEB_ROLES: UserRole[] = ['ADMIN', 'ORG_ADMIN', 'DISPATCHER'];

// ── JWT payload shape ──────────────────────────────────────────────────────────
export interface TokenPayload {
  sub: string;       // user UUID
  role: UserRole;
  status: string;    // ACTIVE | SUSPENDED | …
  iat: number;       // issued-at (epoch seconds)
  exp: number;       // expiry  (epoch seconds)
}

// ── API contract ───────────────────────────────────────────────────────────────
export interface SigninPayload {
  userName?: string;
  password?: string;
  phoneNumber?: string;
  pin?: string;
}

export interface SignupPayload {
  email: string;
  name: string;
  password: string;
  phoneNumber: string;
  address: string;
  status: string;
  role: string;
}

export interface AuthResponse {
  data: { token: string };
}

export interface OrgRegisterPayload {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  orgName: string;
  orgContactPhone: string;
  orgContactEmail?: string;
  businessRegistrationNumber?: string;
}

export interface OrgRegisterData {
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  organisationId: string;
  organisationName: string;
  organisationSlug: string;
}

// ── Service ────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'tih_token';

  /**
   * Decoded JWT payload as a reactive signal.
   * null  → not logged in or token is expired / malformed.
   * Initialised from localStorage so page refreshes don't lose session.
   */
  readonly tokenPayload = signal<TokenPayload | null>(
    this.decode(localStorage.getItem(this.TOKEN_KEY))
  );

  /** Convenience computed values */
  readonly role    = computed(() => this.tokenPayload()?.role    ?? null);
  readonly userId  = computed(() => this.tokenPayload()?.sub     ?? null);
  readonly status  = computed(() => this.tokenPayload()?.status  ?? null);
  readonly isLoggedIn = computed(() => {
    const p = this.tokenPayload();
    if (!p) return false;
    // Check expiry (exp is in seconds, Date.now() in ms)
    return p.exp * 1000 > Date.now();
  });

  constructor(private http: HttpClient, private router: Router) {}

  // ── Auth calls ───────────────────────────────────────────────────────────────

  signin(payload: SigninPayload) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/users/signin`, payload)
      .pipe(
        tap(res => this.storeToken(res.data.token))
      );
  }

  signup(payload: SignupPayload) {
    return this.http.post<{ data: { id: string } }>(
      `${environment.apiUrl}/users/signup`, payload
    );
  }

  orgRegister(payload: OrgRegisterPayload) {
    return this.http
      .post<{ data: OrgRegisterData }>(`${environment.apiUrl}/org/register`, payload)
      .pipe(tap(res => this.storeToken(res.data.token)));
  }

  signOut() {
    localStorage.removeItem(this.TOKEN_KEY);
    this.tokenPayload.set(null);
    this.router.navigate(['/signin']);
  }

  // ── Token helpers ────────────────────────────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRole(): UserRole | null {
    return this.role();
  }

  getUserId(): string | null {
    return this.userId();
  }

  /**
   * Returns the route the user should land on after login, based on role.
   * Returns null for roles that should not access this dashboard.
   */
  resolveHomeRoute(): string | null {
    switch (this.role()) {
      case 'ADMIN':      return '/admin';
      case 'ORG_ADMIN':
      case 'DISPATCHER': return '/org';
      default:           return null;   // RIDER / CUSTOMER — block
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private storeToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.tokenPayload.set(this.decode(token));
  }

  /**
   * Decodes a JWT without a library.
   * The JWT payload is the second dot-separated segment, base64url-encoded.
   * Returns null if the token is absent, malformed, or expired.
   */
  private decode(token: string | null): TokenPayload | null {
    if (!token) return null;
    try {
      const base64 = token.split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const payload: TokenPayload = JSON.parse(atob(base64));
      // Reject already-expired tokens on startup
      if (payload.exp * 1000 <= Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
