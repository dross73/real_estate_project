import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { AuthTokenResponse, LoginCredentials } from '../models/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Send authentication requests to the FastAPI backend
  private readonly http = inject(HttpClient);

  // FastAPI login endpoint
  private readonly loginUrl = 'http://localhost:8000/auth/login';

  // Browser storage key for the JWT access token
  private readonly tokenKey = 'access_token';

  // Submit the email and password in the format FastAPI expects
  login(credentials: LoginCredentials): Observable<AuthTokenResponse> {
    const body = new HttpParams()
      .set('username', credentials.email)
      .set('password', credentials.password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    return this.http
      .post<AuthTokenResponse>(this.loginUrl, body.toString(), { headers })
      .pipe(
        tap((response) => {
          // Store the token after FastAPI accepts the credentials
          localStorage.setItem(this.tokenKey, response.access_token);
        }),
      );
  }

  // Return the stored token for protected routes and API requests
  getAccessToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Check whether an access token is currently stored
  isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }
  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }
}
