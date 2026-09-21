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
