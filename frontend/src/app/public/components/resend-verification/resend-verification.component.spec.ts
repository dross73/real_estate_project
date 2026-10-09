import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { MessageResponse } from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';
import { ResendVerificationComponent } from './resend-verification.component';

describe('ResendVerificationComponent', () => {
  let fixture: ComponentFixture<ResendVerificationComponent>;
  let component: ResendVerificationComponent;
  let auth: jasmine.SpyObj<AuthService>;
  const message = 'If an unverified account exists for that email, a verification message will be sent.';

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['resendVerification']);
    auth.resendVerification.and.returnValue(of({ message }));
    await TestBed.configureTestingModule({
      imports: [ResendVerificationComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(ResendVerificationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('email', 'person@example.com');
    fixture.detectChanges();
  });

  it('should prefill the registered email and show the generic backend message', () => {
    expect(fixture.nativeElement.querySelector('input').value).toBe('person@example.com');
    component.resendForm.setValue({ email: ' person@example.com ' });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(auth.resendVerification).toHaveBeenCalledOnceWith('person@example.com');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(message);
    expect(component.isSubmitting).toBeFalse();
  });

  it('should reject invalid email with an associated field error', () => {
    component.resendForm.setValue({ email: 'bad' });
    component.onSubmit();
    fixture.detectChanges();
    expect(auth.resendVerification).not.toHaveBeenCalled();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('resend-verification-email-error');
  });

  it('should block duplicate submissions until the request completes', () => {
    const pending = new Subject<MessageResponse>();
    auth.resendVerification.and.returnValue(pending);
    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();
    expect(auth.resendVerification).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('button').disabled).toBeTrue();
    pending.next({ message });
    pending.complete();
    expect(component.isSubmitting).toBeFalse();
  });

  it('should allow retry after a service error and clear the old error on success', () => {
    auth.resendVerification.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Please try again');
    expect(component.isSubmitting).toBeFalse();
    auth.resendVerification.and.returnValue(of({ message }));
    component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(component.successMessage).toBe(message);
  });
});
