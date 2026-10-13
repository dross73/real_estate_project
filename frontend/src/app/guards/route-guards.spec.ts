import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { ADMIN_ROUTES } from '../admin/admin.routes';
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
      'getUserRole', 'getMfaStatus', 'logout',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    });

    router = TestBed.inject(Router);
    authService.getMfaStatus.and.returnValue(of({ enabled: false, required: false, enrolled_at: null, recovery_codes_remaining: 0 }));
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

  it('validates demo viewer access with the server before entering admin pages', async () => {
    authService.getUserRole.and.returnValue('viewer');
    expect(await firstValueFrom(runGuard(authGuard) as unknown as Observable<boolean>)).toBeTrue();
    expect(authService.getMfaStatus).toHaveBeenCalled();
  });

  it('logs out stale viewer tokens when the server disables demo access', async () => {
    authService.getUserRole.and.returnValue('viewer');
    authService.getMfaStatus.and.returnValue(throwError(() => new Error('disabled')));
    const result = await firstValueFrom(runGuard(authGuard) as unknown as Observable<UrlTree>);
    expect(router.serializeUrl(result)).toBe('/admin/login');
    expect(authService.logout).toHaveBeenCalled();
  });

  it('lets viewers explore every existing admin route', () => {
    authService.getUserRole.and.returnValue('viewer');
    const layout = ADMIN_ROUTES.find(route => route.children)!;
    expect(layout.canActivateChild).toBeUndefined();
    for (const route of layout.children!) {
      for (const guard of route.canActivate ?? []) {
        expect(guard).toBe(adminGuard);
        expect(runGuard(adminGuard)).toBeTrue();
      }
    }
  });

  for (const role of ['admin', 'staff'] as const) {
    it(`preserves ${role} entry behavior without the viewer server check`, () => {
      authService.getUserRole.and.returnValue(role);
      authService.isStaffOrAdmin.and.returnValue(true);
      expect(runGuard(authGuard)).toBeTrue();
      expect(authService.getMfaStatus).not.toHaveBeenCalled();
    });
  }
});
