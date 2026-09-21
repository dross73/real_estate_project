import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'requestPasswordReset',
    ]);
    authService.requestPasswordReset.and.returnValue(
      of({ message: 'If an eligible account exists, a reset message will be sent.' }),
    );

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should request a reset for a valid email', () => {
    component.resetRequestForm.setValue({
      email: 'person@example.com',
    });

    component.onSubmit();

    expect(authService.requestPasswordReset).toHaveBeenCalledWith(
      'person@example.com',
    );
    expect(component.successMessage).toContain('eligible account');
  });
});
