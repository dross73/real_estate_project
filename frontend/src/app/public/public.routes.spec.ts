import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { PUBLIC_ROUTES } from './public.routes';

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class TestPublicLayout {}

describe('Public registration routes', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['verifyEmail', 'resendVerification']);
    auth.verifyEmail.and.returnValue(of({ status: 'verified' }));
    TestBed.configureTestingModule({
      providers: [
        // Exercise the actual child routes without the layout's unrelated settings requests.
        provideRouter(PUBLIC_ROUTES.map((route) => ({ ...route, component: TestPublicLayout }))),
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  it('should allow signed-out visitors to open registration', async () => {
    const harness = await RouterTestingHarness.create('/account/register');
    expect(harness.routeNativeElement?.querySelector('#register-name')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/account/login"]')).not.toBeNull();
  });

  it('should open the requested account verification route with its token', async () => {
    const harness = await RouterTestingHarness.create('/account/verify-email?token=account-token');
    expect(auth.verifyEmail).toHaveBeenCalledOnceWith('account-token');
    expect(harness.routeNativeElement?.textContent).toContain('has been verified');
  });

  it('should preserve the backend email token through the legacy-path redirect', async () => {
    const harness = await RouterTestingHarness.create('/verify-email?token=backend%2Bemail%2Ftoken');
    expect(TestBed.inject(Router).url).toContain('/account/verify-email?token=');
    expect(auth.verifyEmail).toHaveBeenCalledOnceWith('backend+email/token');
    expect(harness.routeNativeElement?.textContent).toContain('has been verified');
  });

  it('should link sign-in to registration and resend', async () => {
    const harness = await RouterTestingHarness.create('/account/login');
    expect(harness.routeNativeElement?.querySelector('a[href="/account/register"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/account/verify-email"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/account/forgot-password"]')).not.toBeNull();
  });
});
