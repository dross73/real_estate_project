import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'resetPassword',
    ]);
    authService.resetPassword.and.returnValue(
      of({ message: 'Password has been reset.' }),
    );

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ token: 'secure-token' }),
            },
          },
        },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should submit matching replacement passwords with the route token', () => {
    component.resetForm.setValue({
      newPassword: 'NewPassword456!',
      confirmPassword: 'NewPassword456!',
    });

    component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'secure-token',
      'NewPassword456!',
    );
    expect(component.resetComplete).toBeTrue();
  });

  it('should reject mismatched confirmation before calling the API', () => {
    component.resetForm.setValue({
      newPassword: 'NewPassword456!',
      confirmPassword: 'DifferentPassword789!',
    });

    component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('do not match');
  });
});
