import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  AuthTokenPayload,
  AuthTokenResponse,
  LoginCredentials,
  MessageResponse,
  PasswordChangePayload,
  PublicAccount,
  PublicAccountUpdate,
  UserRole,
} from '../models/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Send authentication requests to the FastAPI backend
  private readonly http = inject(HttpClient);

  private readonly authBaseUrl = 'http://localhost:8000/auth';

  // FastAPI login endpoint
  private readonly loginUrl = `${this.authBaseUrl}/login`;

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

  requestPasswordReset(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.authBaseUrl}/password-reset/request`,
      { email },
    );
  }

  resetPassword(
    token: string,
    newPassword: string,
  ): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.authBaseUrl}/password-reset/confirm`,
      {
        token,
        new_password: newPassword,
      },
    );
  }

  getPublicAccount(): Observable<PublicAccount> {
    return this.http.get<PublicAccount>(`${this.authBaseUrl}/account`);
  }

  updatePublicAccount(
    payload: PublicAccountUpdate,
  ): Observable<PublicAccount> {
    return this.http.put<PublicAccount>(
      `${this.authBaseUrl}/account`,
      payload,
    );
  }

  changePublicAccountPassword(
    payload: PasswordChangePayload,
  ): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.authBaseUrl}/account/change-password`,
      payload,
    );
  }

  // Return the stored token for protected routes and API requests
  getAccessToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Decode the stored JWT so Angular can read claims such as role and email
  getTokenPayload(): AuthTokenPayload | null {
    const token = this.getAccessToken();

    if (!token) {
      return null;
    }

    try {
      // JWTs contain header.payload.signature, so the middle section is the payload
      const payload = token.split('.')[1];

      if (!payload) {
        return null;
      }

      // Convert Base64 URL encoding into standard Base64 for the browser
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');

      const paddedPayload = normalizedPayload.padEnd(
        Math.ceil(normalizedPayload.length / 4) * 4,
        '=',
      );

      return JSON.parse(atob(paddedPayload)) as AuthTokenPayload;
    } catch {
      return null;
    }
  }

  // Return the role stored in the authenticated user's JWT
  getUserRole(): UserRole | null {
    return this.getTokenPayload()?.role ?? null;
  }

  // Check whether the authenticated user has the admin role
  isAdmin(): boolean {
    return this.getUserRole() === 'admin';
  }

  // Check whether the authenticated user may enter the internal admin application
  isStaffOrAdmin(): boolean {
    const role = this.getUserRole();
    return role === 'admin' || role === 'staff';
  }

  // Check whether an access token is currently stored
  isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }
}
