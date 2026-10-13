import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { AdminDemoService } from '../services/admin-demo.service';

function token(role: string, expired = false): string {
  return `header.${btoa(JSON.stringify({ role, sub: `${role}@example.test`, exp: expired ? 1 : 9999999999 }))}.signature`;
}

describe('authentication with a previous session and the real interceptor', () => {
  let auth: AuthService;
  let http: HttpClient;
  let controller: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { controller.verify(); localStorage.clear(); });

  for (const [previous, next] of [['viewer', 'admin'], ['viewer', 'staff'], ['viewer', 'viewer'], ['admin', 'viewer']] as const) {
    it(`switches ${previous} to ${next} without clearing storage`, () => {
      localStorage.setItem('access_token', token(previous));
      auth.login({ email: `${next}@example.test`, password: 'Test-only-password' }).subscribe();
      const request = controller.expectOne('http://localhost:8000/auth/login');
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush({ status: 'authenticated', access_token: token(next), token_type: 'bearer' });
      expect(auth.getUserRole()).toBe(next);
      expect(auth.getAccessToken()).toBe(token(next));
      expect(TestBed.inject(AdminDemoService).blocked()).toBeFalse();
    });
  }

  it('permits login with an expired viewer token, then logout and staff login', () => {
    localStorage.setItem('access_token', token('viewer', true));
    auth.login({ email: 'admin@example.test', password: 'test' }).subscribe();
    const first = controller.expectOne('http://localhost:8000/auth/login');
    expect(first.request.headers.has('Authorization')).toBeFalse();
    first.flush({ status: 'authenticated', access_token: token('admin') });
    auth.logout();
    expect(auth.getAccessToken()).toBeNull();
    auth.login({ email: 'staff@example.test', password: 'test' }).subscribe();
    controller.expectOne('http://localhost:8000/auth/login').flush({ status: 'authenticated', access_token: token('staff') });
    expect(auth.getUserRole()).toBe('staff');
  });

  for (const path of ['/register', '/email-verification/verify', '/email-verification/resend', '/password-reset/request', '/password-reset/confirm', '/mfa/challenge/verify', '/mfa/challenge/enrollment-start', '/mfa/challenge/enrollment-confirm']) {
    it(`allows sessionless ${path} without an old bearer token`, () => {
      localStorage.setItem('access_token', token('viewer'));
      const url = 'http://localhost:8000/auth' + path;
      http.post(url, {}, { headers: new HttpHeaders({ Authorization: 'Bearer old-token' }) }).subscribe();
      const request = controller.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush({});
    });
  }

  for (const path of ['/auth/account', '/auth/account/change-password', '/auth/account/archive', '/auth/mfa/enrollment/start', '/auth/mfa/enrollment/confirm', '/auth/mfa/disable', '/auth/mfa/admin-reset/1', '/listings', '/auth/login/other']) {
    it(`still blocks viewer mutation of ${path}`, () => {
      localStorage.setItem('access_token', token('viewer'));
      let status = 0;
      const url = 'http://localhost:8000' + path;
      http.post(url, {}).subscribe({ error: error => status = error.status });
      expect(status).toBe(403);
      controller.expectNone(url);
    });
  }
});
