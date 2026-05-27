import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserService, User } from '../../features/users/services/user.service';

/**
 * Guarantees `UserService.profile()` is populated before any org-dashboard
 * child component activates. On direct URL load, the profile HTTP request
 * completes before Angular renders a single child component.
 *
 * On subsequent in-app navigations the signal is already set, so we skip
 * the request entirely.
 */
export const profileResolver: ResolveFn<User | null> = () => {
  const userService = inject(UserService);

  if (userService.profile()) return of(userService.profile());

  return userService.getMyProfile().pipe(
    map(res => res.data),
    catchError(() => of(null)),
  );
};
