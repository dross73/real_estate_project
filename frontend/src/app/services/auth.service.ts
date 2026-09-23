import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  AuthTokenPayload,
  AuthTokenResponse,
  LoginCredentials,
  MessageResponse,
  MfaEnrollmentCompleteResponse,
  MfaEnrollmentStartResponse,
  MfaStatusResponse,
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
      .pipe(tap((response) => this.storeAuthenticatedResponse(response)));
  }

  verifyMfaChallenge(
    challengeToken: string,
    code: string,
  ): Observable<AuthTokenResponse> {
    return this.http
      .post<AuthTokenResponse>(`${this.authBaseUrl}/mfa/challenge/verify`, {
        challenge_token: challengeToken,
        code,
      })
      .pipe(tap((response) => this.storeAuthenticatedResponse(response)));
  }

  startRequiredMfaEnrollment(
    challengeToken: string,
  ): Observable<MfaEnrollmentStartResponse> {
    return this.http.post<MfaEnrollmentStartResponse>(
      `${this.authBaseUrl}/mfa/challenge/enrollment-start`,
      { challenge_token: challengeToken },
    );
  }

  confirmRequiredMfaEnrollment(
    challengeToken: string,
    enrollmentToken: string,
    code: string,
  ): Observable<MfaEnrollmentCompleteResponse> {
    return this.http
      .post<MfaEnrollmentCompleteResponse>(
        `${this.authBaseUrl}/mfa/challenge/enrollment-confirm`,
        {
          challenge_token: challengeToken,
          enrollment_token: enrollmentToken,
          code,
        },
      )
      .pipe(tap((response) => this.storeAccessToken(response.access_token)));
  }

  getMfaStatus(): Observable<MfaStatusResponse> {
    return this.http.get<MfaStatusResponse>(`${this.authBaseUrl}/mfa/status`);
  }

  startMfaEnrollment(): Observable<MfaEnrollmentStartResponse> {
    return this.http.post<MfaEnrollmentStartResponse>(
      `${this.authBaseUrl}/mfa/enrollment/start`,
      {},
    );
  }

  confirmMfaEnrollment(
    enrollmentToken: string,
    code: string,
  ): Observable<MfaEnrollmentCompleteResponse> {
    return this.http.post<MfaEnrollmentCompleteResponse>(
      `${this.authBaseUrl}/mfa/enrollment/confirm`,
      {
        enrollment_token: enrollmentToken,
        code,
      },
    );
  }

  disableMfa(
    currentPassword: string,
    code: string,
  ): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.authBaseUrl}/mfa/disable`,
      {
        current_password: currentPassword,
        code,
      },
    );
  }

  adminResetMfa(
    userId: number,
    currentPassword: string,
  ): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.authBaseUrl}/mfa/admin-reset/${userId}`,
      { current_password: currentPassword },
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

  archivePublicAccount(currentPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.authBaseUrl}/account/archive`,
      { current_password: currentPassword },
    );
  }

  private storeAuthenticatedResponse(response: AuthTokenResponse): void {
    if (response.status !== 'authenticated') {
      return;
    }

    this.storeAccessToken(response.access_token);
  }

  private storeAccessToken(token: string | null): void {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    }
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
