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

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpController: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getAccessToken',
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
});
