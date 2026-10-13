import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { AdminDemoService } from '../services/admin-demo.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpController: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getAccessToken',
      'getUserRole',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should attach the bearer token when one is available', () => {
    authService.getAccessToken.and.returnValue('secure-token');

    http.get('/protected').subscribe();

    const request = httpController.expectOne('/protected');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer secure-token',
    );
    request.flush({});
  });

  it('should leave anonymous requests without an Authorization header', () => {
    authService.getAccessToken.and.returnValue(null);

    http.get('/public').subscribe();

    const request = httpController.expectOne('/public');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    it(`blocks accidental viewer ${method} requests before sending them`, () => {
      authService.getAccessToken.and.returnValue('viewer-token');
      authService.getUserRole.and.returnValue('viewer');
      let status = 0;
      http.request(method, '/listings/1', { body: {} }).subscribe({ error: error => { status = error.status; } });
      expect(status).toBe(403);
      expect(TestBed.inject(AdminDemoService).blocked()).toBeTrue();
      expect(TestBed.inject(AdminDemoService).message).toBe('Demo Mode — Changes are disabled.');
      httpController.expectNone('/listings/1');
    });
  }
  for (const role of ['admin', 'staff'] as const) {
    it(`keeps ${role} write requests working`, () => {
      authService.getAccessToken.and.returnValue('token');
      authService.getUserRole.and.returnValue(role);
      http.post('/listings', {}).subscribe();
      httpController.expectOne('/listings').flush({});
    });
  }

  it('allows viewer GET requests and still supplies the access token', () => {
    authService.getAccessToken.and.returnValue('viewer-token');
    authService.getUserRole.and.returnValue('viewer');
    http.get('/listings').subscribe();
    const request = httpController.expectOne('/listings');
    expect(request.request.headers.get('Authorization')).toBe('Bearer viewer-token');
    request.flush({});
  });

});
