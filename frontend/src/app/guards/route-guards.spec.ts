import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';
import { publicUserGuard } from './public-user.guard';
import { AuthService } from '../services/auth.service';

describe('route guards', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAdmin',
      'isAuthenticated',
      'isStaffOrAdmin',
      'getUserRole',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    });

    router = TestBed.inject(Router);
  });

  function runGuard(
    guard: typeof authGuard,
  ): boolean | UrlTree {
    return TestBed.runInInjectionContext(
      () =>
        guard(
          {} as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
        ) as boolean | UrlTree,
    );
  }

  it('should allow staff/admin into the internal application', () => {
    authService.isStaffOrAdmin.and.returnValue(true);

    expect(runGuard(authGuard)).toBeTrue();
  });

  it('should redirect non-internal users to the admin login', () => {
    authService.isStaffOrAdmin.and.returnValue(false);

    const result = runGuard(authGuard) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/admin/login');
  });

  it('should allow admins through admin-only routes', () => {
    authService.isAdmin.and.returnValue(true);

    expect(runGuard(adminGuard)).toBeTrue();
  });

  it('should redirect staff away from admin-only routes', () => {
    authService.isAdmin.and.returnValue(false);

    const result = runGuard(adminGuard) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/admin/dashboard');
  });

  it('should allow only authenticated public users into account routes', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');

    expect(runGuard(publicUserGuard)).toBeTrue();

    authService.getUserRole.and.returnValue('staff');
    const result = runGuard(publicUserGuard) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/account/login');
  });

  it('should redirect signed-out visitors from public account routes', () => {
    authService.isAuthenticated.and.returnValue(false);
    authService.getUserRole.and.returnValue(null);

    const result = runGuard(publicUserGuard) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/account/login');
  });
});
