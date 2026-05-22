import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from '../auth.service';

/**
 * Factory guard — use inside route definitions:
 *
 *   canActivate: [authGuard, roleGuard(['ADMIN'])]
 *   canActivate: [authGuard, roleGuard(['ORG_ADMIN', 'DISPATCHER'])]
 *
 * Assumes authGuard already ran (user IS logged in).
 * Redirects to /access-denied when the role is not in the allowed list.
 */
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    const role   = auth.getRole();

    if (role && allowedRoles.includes(role)) return true;

    return router.createUrlTree(['/access-denied']);
  };
};
