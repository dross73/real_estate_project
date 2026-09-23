import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { SecurityComponent } from './security.component';

describe('SecurityComponent', () => {
  let fixture: ComponentFixture<SecurityComponent>;
  let component: SecurityComponent;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getMfaStatus',
      'startMfaEnrollment',
      'confirmMfaEnrollment',
      'disableMfa',
    ]);
    authService.getMfaStatus.and.returnValue(
      of({
        enabled: false,
        required: false,
        enrolled_at: null,
        recovery_codes_remaining: 0,
      }),
    );
    authService.startMfaEnrollment.and.returnValue(
      of({
        secret: 'SECRET',
        provisioning_uri: 'otpauth://totp/example',
        enrollment_token: 'enrollment-token',
      }),
    );
    authService.confirmMfaEnrollment.and.returnValue(
      of({
        recovery_codes: ['AAAA-BBBB'],
        access_token: null,
        token_type: null,
      }),
    );
    authService.disableMfa.and.returnValue(of({ message: 'disabled' }));

    await TestBed.configureTestingModule({
      imports: [SecurityComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SecurityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the current MFA status', () => {
    expect(authService.getMfaStatus).toHaveBeenCalled();
    expect(component.status?.enabled).toBeFalse();
  });

  it('should verify enrollment before showing recovery codes', () => {
    component.startEnrollment();
    component.enrollmentForm.setValue({ code: '123456' });

    component.confirmEnrollment();

    expect(authService.confirmMfaEnrollment).toHaveBeenCalledWith(
      'enrollment-token',
      '123456',
    );
    expect(component.recoveryCodes).toEqual(['AAAA-BBBB']);
  });
});
