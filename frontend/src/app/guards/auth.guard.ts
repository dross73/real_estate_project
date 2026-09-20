import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

// Allow the internal admin application only for staff and administrators.
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isStaffOrAdmin()) {
    return true;
  }

  // Public users and unauthenticated visitors must use a non-admin experience.
  return router.createUrlTree(['/admin/login']);
};
