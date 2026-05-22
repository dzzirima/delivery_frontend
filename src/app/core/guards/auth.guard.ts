import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

/**
 * Blocks unauthenticated users from reaching any protected route.
 * Redirects to /signin, preserving the intended URL as a query param
 * so signin can bounce them back after login.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  return router.createUrlTree(['/signin'], {
    queryParams: { returnUrl: state.url },
  });
};
