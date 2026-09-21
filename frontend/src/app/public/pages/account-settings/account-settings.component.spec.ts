import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { AccountSettingsComponent } from './account-settings.component';

describe('AccountSettingsComponent', () => {
  let fixture: ComponentFixture<AccountSettingsComponent>;
  let component: AccountSettingsComponent;
  let authService: jasmine.SpyObj<AuthService>;

  const account = {
    id: 1,
    email: 'person@example.com',
    full_name: 'Person',
    phone: null,
    is_active: true,
    role: 'public_user' as const,
  };

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getPublicAccount',
      'updatePublicAccount',
      'changePublicAccountPassword',
    ]);
    authService.getPublicAccount.and.returnValue(of(account));
    authService.updatePublicAccount.and.returnValue(
      of({
        ...account,
        full_name: 'Updated Person',
        phone: '515-555-0110',
      }),
    );
    authService.changePublicAccountPassword.and.returnValue(
      of({ message: 'Password has been changed.' }),
    );

    await TestBed.configureTestingModule({
      imports: [AccountSettingsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load and update the current profile', () => {
    expect(component.account?.email).toBe('person@example.com');

    component.profileForm.setValue({
      fullName: 'Updated Person',
      phone: '515-555-0110',
    });
    component.saveProfile();

    expect(authService.updatePublicAccount).toHaveBeenCalledWith({
      full_name: 'Updated Person',
      phone: '515-555-0110',
    });
    expect(component.profileMessage).toContain('updated');
  });

  it('should change the password only when confirmation matches', () => {
    component.passwordForm.setValue({
      currentPassword: 'Password123!',
      newPassword: 'NewPassword456!',
      confirmPassword: 'NewPassword456!',
    });
    component.changePassword();

    expect(authService.changePublicAccountPassword).toHaveBeenCalledWith({
      current_password: 'Password123!',
      new_password: 'NewPassword456!',
    });
    expect(component.passwordMessage).toContain('successfully');
  });
});
