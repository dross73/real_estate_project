import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// New admin routes are restricted by default, even if they only fetch data.
export const adminViewerGuard: CanActivateChildFn = route => {
  const auth = inject(AuthService);
  if (auth.getUserRole() !== 'viewer' || route.data['allowViewer'] === true) return true;
  return inject(Router).createUrlTree(['/admin/dashboard']);
};
