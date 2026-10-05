import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { PublicAccount } from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';
import { PublicRegisterComponent } from './public-register.component';

describe('PublicRegisterComponent', () => {
  let fixture: ComponentFixture<PublicRegisterComponent>;
  let component: PublicRegisterComponent;
  let auth: jasmine.SpyObj<AuthService>;
  const account: PublicAccount = {
    id: 1, email: 'person@example.com', full_name: 'Person', phone: null,
    is_active: true, archived_at: null, role: 'public_user',
  };
  const validForm = {
    full_name: ' Person ', email: ' person@example.com ',
    password: 'Password123!', confirmPassword: 'Password123!',
  };

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['register', 'resendVerification']);
    auth.register.and.returnValue(of(account));
    await TestBed.configureTestingModule({
      imports: [PublicRegisterComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should submit trimmed details without confirmation or role and display check-your-email with resend', () => {
    component.registrationForm.setValue(validForm);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(auth.register).toHaveBeenCalledOnceWith({
      full_name: 'Person', email: 'person@example.com', password: 'Password123!',
    });
    expect(fixture.nativeElement.textContent).toContain('Check your email');
    expect(fixture.nativeElement.textContent).toContain(account.email);
    expect(fixture.nativeElement.querySelector('#register-password')).toBeNull();
    expect(component.registrationForm.controls.password.value).toBe('');
    expect(fixture.nativeElement.querySelector('#resend-verification-email').value).toBe(account.email);
    expect(fixture.nativeElement.querySelector('a[href="/account/login"]')).not.toBeNull();
    component.onSubmit();
    expect(auth.register).toHaveBeenCalledTimes(1);
  });

  it('should require all four fields and show accessible validation errors', () => {
    component.onSubmit();
    fixture.detectChanges();
    expect(auth.register).not.toHaveBeenCalled();
    for (const id of ['register-name', 'register-email', 'register-password', 'register-confirm-password']) {
      const input = fixture.nativeElement.querySelector(`#${id}`);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(fixture.nativeElement.querySelector(`#${input.getAttribute('aria-describedby').split(' ').pop()}`)).not.toBeNull();
    }
  });

  for (const [label, changes] of [
    ['a blank name', { full_name: '   ' }],
    ['an invalid email', { email: 'invalid' }],
    ['a short password', { password: 'short', confirmPassword: 'short' }],
    ['mismatched passwords', { confirmPassword: 'DifferentPassword!' }],
    ['a password over the byte limit', { password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }],
  ] as const) {
    it(`should reject ${label} without calling registration`, () => {
      component.registrationForm.setValue({ ...validForm, ...changes });
      component.onSubmit();
      expect(auth.register).not.toHaveBeenCalled();
      expect(component.registrationForm.invalid).toBeTrue();
    });
  }

  it('should accept a password at the 72-byte limit without trimming it', () => {
    const password = ' ' + 'é'.repeat(35) + ' ';
    component.registrationForm.setValue({ ...validForm, password, confirmPassword: password });
    component.onSubmit();
    expect(auth.register.calls.mostRecent().args[0].password).toBe(password);
  });

  it('should prevent duplicate requests while submitting', () => {
    const pending = new Subject<PublicAccount>();
    auth.register.and.returnValue(pending);
    component.registrationForm.setValue(validForm);
    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();
    expect(auth.register).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
    pending.next(account);
    pending.complete();
    expect(component.isSubmitting).toBeFalse();
  });

  for (const [status, message] of [
    [409, 'An account already uses this email'],
    [422, 'Check your name, email, and password'],
    [500, 'Please try again'],
  ] as const) {
    it(`should display a recoverable error for HTTP ${status}`, () => {
      auth.register.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      component.registrationForm.setValue(validForm);
      component.onSubmit();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
      expect(component.registrationComplete).toBeFalse();
      expect(component.isSubmitting).toBeFalse();
      expect(fixture.nativeElement.querySelector('a[href="/account/verify-email"]')).not.toBeNull();
      auth.register.and.returnValue(of(account));
      component.onSubmit();
      expect(component.registrationComplete).toBeTrue();
    });
  }
});
