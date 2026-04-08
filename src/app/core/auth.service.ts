import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SigninPayload {
  userName: string;
  password: string;
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
  data: {
    token: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string | null;
  organisationName: string | null;
  organisationStatus: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'tih_token';
  private readonly RESET_EMAIL_KEY = 'tih_reset_email';

  /** Reactive signal of the current user's role. Initialised from any stored token. */
  readonly role = signal<string | null>(this.getRole());

  constructor(private http: HttpClient, private router: Router) {}

  signin(payload: SigninPayload) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/user/signin`, payload)
      .pipe(tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.data.token);
        this.role.set(this.getRole());
      }));
  }

  signup(payload: SignupPayload) {
    return this.http.post<{ data: { id: string } }>(`${environment.apiUrl}/user/signup`, payload);
  }

  signOut() {
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.RESET_EMAIL_KEY);
    this.role.set(null);
    this.router.navigate(['/signin']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role ?? payload.roles?.[0] ?? null;
    } catch {
      return null;
    }
  }

  getProfile() {
    return this.http.get<{ data: UserProfile }>(`${environment.apiUrl}/user/profile`);
  }

  forgotPassword(email: string) {
    sessionStorage.setItem(this.RESET_EMAIL_KEY, email);
    return this.http.post<{ data: null }>(`${environment.apiUrl}/reset-password/forgot`, { email });
  }

  resetPassword(code: string, newPassword: string) {
    const email = sessionStorage.getItem(this.RESET_EMAIL_KEY) ?? '';
    return this.http
      .post<{ data: null }>(`${environment.apiUrl}/reset-password/reset`, {
        email,
        code,
        newPassword,
      })
      .pipe(tap(() => sessionStorage.removeItem(this.RESET_EMAIL_KEY)));
  }
}
