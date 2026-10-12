import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

// Add the stored access token to FastAPI requests
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const accessToken = authService.getAccessToken();

  if (accessToken && authService.getUserRole() === 'viewer' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return throwError(() => new HttpErrorResponse({ status: 403, error: { detail: 'Demo access is read only' } }));
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
