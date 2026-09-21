import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

// Keep public-account settings restricted to signed-in public users.
export const publicUserGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (
    authService.isAuthenticated() &&
    authService.getUserRole() === 'public_user'
  ) {
    return true;
  }

  return router.createUrlTree(['/account/login']);
};
