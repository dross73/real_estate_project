import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

// Allow access only when the authenticated user has the admin role
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  // Send non-admin users back to the admin dashboard
  return router.createUrlTree(['/admin/dashboard']);
};
