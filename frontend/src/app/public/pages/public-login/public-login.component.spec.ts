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
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'getUserRole', 'logout']);
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
});
