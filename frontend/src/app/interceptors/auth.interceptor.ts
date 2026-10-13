import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AdminDemoService } from '../services/admin-demo.service';

// Add the stored access token to FastAPI requests
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
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
