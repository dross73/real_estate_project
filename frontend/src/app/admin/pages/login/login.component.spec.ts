import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'login',
      'verifyMfaChallenge',
      'startRequiredMfaEnrollment',
      'confirmRequiredMfaEnrollment',
    ]);
    authService.login.and.returnValue(
      of({
        status: 'authenticated',
        access_token: 'token',
        token_type: 'bearer',
        challenge_token: null,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the second-factor step when password login requires MFA', () => {
    authService.login.and.returnValue(
      of({
        status: 'mfa_required',
        access_token: null,
        token_type: null,
        challenge_token: 'challenge-token',
      }),
    );
    component.loginForm.setValue({
      email: 'admin@example.com',
      password: 'Password123!',
    });

    component.onSubmit();

    expect(component.step()).toBe('challenge');
  });

  it('should start required enrollment when the MFA policy requires setup', () => {
    authService.login.and.returnValue(
      of({
        status: 'mfa_enrollment_required',
        access_token: null,
        token_type: null,
        challenge_token: 'challenge-token',
      }),
    );
    authService.startRequiredMfaEnrollment.and.returnValue(
      of({
        secret: 'SECRET',
        provisioning_uri: 'otpauth://totp/example',
        enrollment_token: 'enrollment-token',
      }),
    );
    component.loginForm.setValue({
      email: 'staff@example.com',
      password: 'Password123!',
    });

    component.onSubmit();

    expect(authService.startRequiredMfaEnrollment).toHaveBeenCalledWith(
      'challenge-token',
    );
    expect(component.step()).toBe('enrollment');
  });
});
