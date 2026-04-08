import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

/**
 * Single RBAC guard — handles both authentication and role-based access.
 *
 * Usage in app.routes.ts:
 *   {
 *     path: 'users',
 *     canActivate: [roleGuard],
 *     data: { roles: ['ORG_ADMIN', 'HR', 'MANAGER'] },
 *     ...
 *   }
 *
 * Behaviour:
 *  - Not authenticated          → redirect to /signin
 *  - roles[] is empty or absent → any authenticated user passes
 *  - Role not in roles[]        → toast error, stay on current page (no redirect)
 *
 * Valid roles (from UserRole enum):
 *   AGENT | HR | IT | OPERATIONS | MANAGER | CALL_CENTER_AGENT
 *   STAFF | SYSTEM_ADMIN | ORG_ADMIN
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const toast  = inject(ToastService);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/signin']);
  }

  const requiredRoles: string[] = route.data?.['roles'] ?? [];
  if (requiredRoles.length === 0) {
    return true;
  }

  const userRole = auth.role();
  if (userRole && requiredRoles.includes(userRole)) {
    return true;
  }

  toast.error('Access denied', 'You do not have permission to view this page.');
  return false;
};
