import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Paths that must never carry an Authorization header */
const PUBLIC_PATHS = [
  '/users/signin',
  '/users/signup',
  '/org/register',
  '/reset-password/',
  '/health/',
];

function isPublic(url: string): boolean {
  return PUBLIC_PATHS.some(path => url.includes(path));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  // Attach token only to protected endpoints
  if (!isPublic(req.url)) {
    const token = authService.getToken();
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isPublic(req.url)) {
        // Token is invalid / expired / user deleted — clear session and redirect
        const message = err.error?.message ?? 'Session expired. Please sign in again.';
        authService.signOut();
        router.navigate(['/signin'], { state: { authError: message } });
      }
      return throwError(() => err);
    }),
  );
};
