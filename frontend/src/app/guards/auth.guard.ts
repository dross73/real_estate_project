import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

// Allow the internal admin application for staff, administrators and read-only viewers.
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isStaffOrAdmin() || authService.getUserRole() === 'viewer') {
    return true;
  }

  // Public users and unauthenticated visitors must use a non-admin experience.
  return router.createUrlTree(['/admin/login']);
};
