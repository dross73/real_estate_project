import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AdminDemoService } from '../services/admin-demo.service';
import { apiUrl } from '../core/api-base-url';

// These operations authenticate using submitted credentials/tokens, not a session.
// Enrollment/disable/reset and account mutations intentionally remain protected.
const SESSIONLESS_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/email-verification/verify',
  '/auth/email-verification/resend',
  '/auth/password-reset/request',
  '/auth/password-reset/confirm',
  '/auth/mfa/challenge/verify',
  '/auth/mfa/challenge/enrollment-start',
  '/auth/mfa/challenge/enrollment-confirm',
];

// Add the stored access token to FastAPI requests
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  if (request.method === 'POST' && SESSIONLESS_AUTH_PATHS.some(path => request.url === apiUrl(path))) {
    // Never let an earlier (even expired) account interfere with fresh sign-in.
    return next(request.clone({ headers: request.headers.delete('Authorization') }));
  }
  const accessToken = authService.getAccessToken();

  if (accessToken && authService.getUserRole() === 'viewer' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const demo = inject(AdminDemoService);
    demo.notify();
    return throwError(() => new HttpErrorResponse({ status: 403, error: { detail: demo.message } }));
  }

  // Leave requests unchanged when no token is stored
  if (!accessToken) {
    return next(request);
  }

  // Add the bearer token without modifying the original request
  const authenticatedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return next(authenticatedRequest);
};
