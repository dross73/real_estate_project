import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { EmailVerificationResponse } from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';
import { VerifyEmailComponent } from './verify-email.component';

describe('VerifyEmailComponent', () => {
  let fixture: ComponentFixture<VerifyEmailComponent>;
  let component: VerifyEmailComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let route: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['verifyEmail', 'resendVerification']);
    auth.verifyEmail.and.returnValue(of({ status: 'verified' }));
    route = { snapshot: { queryParamMap: convertToParamMap({ token: 'secure-email-token' }) } };
    await TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: route }, { provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(VerifyEmailComponent);
    component = fixture.componentInstance;
  });

  it('should verify the query token and offer sign-in after success', () => {
    fixture.detectChanges();
    expect(auth.verifyEmail).toHaveBeenCalledOnceWith('secure-email-token');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('has been verified');
    expect(fixture.nativeElement.querySelector('a[href="/account/login"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-resend-verification')).toBeNull();
    expect(component.isVerifying).toBeFalse();
  });

  it('should display the already-verified response as success', () => {
    auth.verifyEmail.and.returnValue(of({ status: 'already_verified' }));
    fixture.detectChanges();
    expect(component.verificationComplete).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('already verified');
  });

  it('should display a loading status until verification completes', () => {
    const pending = new Subject<EmailVerificationResponse>();
    auth.verifyEmail.and.returnValue(pending);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Verifying your email');
    expect(fixture.nativeElement.querySelector('app-resend-verification')).toBeNull();
    pending.next({ status: 'verified' });
    pending.complete();
    fixture.detectChanges();
    expect(component.isVerifying).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('Verifying your email…');
  });

  it('should offer resend without calling verification when the token is missing', () => {
    route.snapshot.queryParamMap = convertToParamMap({});
    fixture.detectChanges();
    expect(auth.verifyEmail).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('missing its security token');
    expect(fixture.nativeElement.querySelector('app-resend-verification')).not.toBeNull();
  });

  for (const [status, message] of [[400, 'invalid, expired, or has already been used'], [422, 'invalid, expired'], [503, 'Try opening the link again']] as const) {
    it(`should display verification HTTP ${status} errors with resend`, () => {
      auth.verifyEmail.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
      expect(fixture.nativeElement.querySelector('app-resend-verification')).not.toBeNull();
      expect(component.verificationComplete).toBeFalse();
      expect(component.isVerifying).toBeFalse();
    });
  }
});
