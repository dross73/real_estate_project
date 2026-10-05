import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { PublicLoginComponent } from './public-login.component';

describe('PublicLoginComponent', () => {
  let fixture: ComponentFixture<PublicLoginComponent>;
  let component: PublicLoginComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'getUserRole', 'logout', 'resendVerification']);
    auth.login.and.returnValue(of({ status: 'authenticated', access_token: 'token', token_type: 'bearer', challenge_token: null }));
    auth.getUserRole.and.returnValue('public_user');
    await TestBed.configureTestingModule({
      imports: [PublicLoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicLoginComponent);
    component = fixture.componentInstance;
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
    component.loginForm.setValue({ email: 'person@example.com', password: 'Password123!' });
  });

  it('should keep customer sign-in navigation', () => {
    component.onSubmit();
    expect(navigate).toHaveBeenCalledWith(['/account']);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  for (const role of ['admin', 'staff'] as const) {
    it(`should continue directing ${role} accounts to internal sign-in`, () => {
      auth.getUserRole.and.returnValue(role);
      component.onSubmit();
      expect(auth.logout).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(component.errorMessage).toContain('admin sign-in');
    });
  }

  it('should preserve failed sign-in handling', () => {
    auth.login.and.returnValue(throwError(() => new Error('rejected')));
    component.onSubmit();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('email or password');
    expect(component.isSubmitting).toBeFalse();
  });

  it('should explain the verification 403 and offer resend with the login email', () => {
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 403, error: { detail: 'Email verification required' },
    })));
    auth.resendVerification.and.returnValue(of({
      message: 'If an unverified account exists for that email, a verification message will be sent.',
    }));

    component.onSubmit();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(auth.getUserRole).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(component.isSubmitting).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Verify your email before signing in');
    expect(fixture.nativeElement.querySelector('#resend-verification-email').value).toBe('person@example.com');

    fixture.nativeElement.querySelector('app-resend-verification form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(auth.resendVerification).toHaveBeenCalledOnceWith('person@example.com');
    expect(fixture.nativeElement.querySelector('app-resend-verification [role="status"]').textContent).toContain('If an unverified account exists');
  });

  for (const [status, detail] of [[401, 'Invalid credentials'], [403, 'Account is inactive'], [503, 'Email verification required']] as const) {
    it(`should not show the verification prompt for ${status}: ${detail}`, () => {
      auth.login.and.returnValue(throwError(() => new HttpErrorResponse({ status, error: { detail } })));
      component.onSubmit();
      fixture.detectChanges();
      expect(component.errorMessage).toContain('email or password');
      expect(fixture.nativeElement.querySelector('app-resend-verification')).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  }

  it('should clear the verification prompt when a later sign-in succeeds', () => {
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 403, error: { detail: 'Email verification required' },
    })));
    component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-resend-verification')).not.toBeNull();

    auth.login.and.returnValue(of({ status: 'authenticated', access_token: 'token', token_type: 'bearer', challenge_token: null }));
    component.onSubmit();
    fixture.detectChanges();
    expect(component.errorMessage).toBe('');
    expect(fixture.nativeElement.querySelector('app-resend-verification')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/account']);
  });
});
