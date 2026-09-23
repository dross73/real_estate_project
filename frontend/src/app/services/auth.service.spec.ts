import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

describe('AuthService public account self-service', () => {
  let service: AuthService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(AuthService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
    localStorage.clear();
  });

  it('should store a token only after authentication is complete', () => {
    service
      .login({
        email: 'admin@example.com',
        password: 'Password123!',
      })
      .subscribe();

    const first = httpController.expectOne(
      'http://localhost:8000/auth/login',
    );
    first.flush({
      status: 'mfa_required',
      access_token: null,
      token_type: null,
      challenge_token: 'challenge-token',
    });

    expect(localStorage.getItem('access_token')).toBeNull();

    service
      .verifyMfaChallenge('challenge-token', '123456')
      .subscribe();

    const verify = httpController.expectOne(
      'http://localhost:8000/auth/mfa/challenge/verify',
    );
    expect(verify.request.body).toEqual({
      challenge_token: 'challenge-token',
      code: '123456',
    });
    verify.flush({
      status: 'authenticated',
      access_token: 'verified-token',
      token_type: 'bearer',
      challenge_token: null,
    });

    expect(localStorage.getItem('access_token')).toBe('verified-token');
  });

  it('should support MFA enrollment and store a refreshed verified token', () => {
    service.startMfaEnrollment().subscribe();
    const start = httpController.expectOne(
      'http://localhost:8000/auth/mfa/enrollment/start',
    );
    expect(start.request.method).toBe('POST');
    start.flush({
      secret: 'SECRET',
      provisioning_uri: 'otpauth://totp/example',
      enrollment_token: 'enrollment-token',
    });

    service.confirmMfaEnrollment('enrollment-token', '123456').subscribe();
    const confirm = httpController.expectOne(
      'http://localhost:8000/auth/mfa/enrollment/confirm',
    );
    expect(confirm.request.body).toEqual({
      enrollment_token: 'enrollment-token',
      code: '123456',
    });
    confirm.flush({
      recovery_codes: ['AAAA-BBBB'],
      access_token: 'mfa-token',
      token_type: 'bearer',
    });

    expect(localStorage.getItem('access_token')).toBe('mfa-token');
  });

  it('should call protected MFA reset with the administrator password', () => {
    service.adminResetMfa(17, 'Password123!').subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/auth/mfa/admin-reset/17',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      current_password: 'Password123!',
    });
    request.flush({ message: 'reset' });
  });

  it('should call the password recovery endpoints', () => {
    const replacement = 'abcdefgh';

    service.requestPasswordReset('person@example.com').subscribe();
    const request = httpController.expectOne(
      'http://localhost:8000/auth/password-reset/request',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'person@example.com' });
    request.flush({ message: 'accepted' });

    service.resetPassword('secure-token', replacement).subscribe();
    const confirm = httpController.expectOne(
      'http://localhost:8000/auth/password-reset/confirm',
    );
    expect(confirm.request.method).toBe('POST');
    expect(confirm.request.body).toEqual({
      token: 'secure-token',
      new_password: replacement,
    });
    confirm.flush({ message: 'changed' });
  });

  it('should request account archival with password confirmation', () => {
    service.archivePublicAccount('Password123!').subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/auth/account/archive',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      current_password: 'Password123!',
    });
    request.flush({ message: 'closed' });
  });

  it('should load and update the authenticated public account', () => {
    service.getPublicAccount().subscribe();

    const getRequest = httpController.expectOne(
      'http://localhost:8000/auth/account',
    );
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush({
      id: 1,
      email: 'person@example.com',
      full_name: 'Person',
      phone: null,
      is_active: true,
      role: 'public_user',
    });

    service
      .updatePublicAccount({
        full_name: 'Updated Person',
        phone: '515-555-0110',
      })
      .subscribe();

    const updateRequest = httpController.expectOne(
      'http://localhost:8000/auth/account',
    );
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual({
      full_name: 'Updated Person',
      phone: '515-555-0110',
    });
    updateRequest.flush({
      id: 1,
      email: 'person@example.com',
      full_name: 'Updated Person',
      phone: '515-555-0110',
      is_active: true,
      role: 'public_user',
    });
  });
});
