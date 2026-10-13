import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

// Allow the internal admin application for staff, administrators and read-only viewers.
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isStaffOrAdmin()) {
    return true;
  }
  if (authService.getUserRole() === 'viewer') {
    // Server checks the current account before entering the admin application.
    return authService.getMfaStatus().pipe(
      map(() => true),
      catchError(() => {
        authService.logout();
        return of(router.createUrlTree(['/admin/login']));
      }),
    );
  }

  // Public users and unauthenticated visitors must use a non-admin experience.
  return router.createUrlTree(['/admin/login']);
};
