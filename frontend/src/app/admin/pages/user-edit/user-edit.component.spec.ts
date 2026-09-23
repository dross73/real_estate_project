import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { UserEditComponent } from './user-edit.component';

describe('UserEditComponent', () => {
  let fixture: ComponentFixture<UserEditComponent>;
  let component: UserEditComponent;
  let userService: jasmine.SpyObj<UserService>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  const user = {
    id: 9,
    email: 'staff@example.com',
    full_name: 'Staff Person',
    is_active: true,
    archived_at: null,
    role: 'staff' as const,
  };

  beforeEach(async () => {
    userService = jasmine.createSpyObj<UserService>('UserService', [
      'getUserById',
      'updateUser',
    ]);
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'adminResetMfa',
    ]);

    userService.getUserById.and.returnValue(of(user));
    userService.updateUser.and.returnValue(of(user));
    authService.adminResetMfa.and.returnValue(
      of({ message: 'MFA enrollment reset.' }),
    );

    await TestBed.configureTestingModule({
      imports: [UserEditComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '9' }),
            },
          },
        },
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEditComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  it('should load the selected user and expose internal MFA recovery', () => {
    expect(userService.getUserById).toHaveBeenCalledWith(9);
    expect(component.isLoading()).toBeFalse();
    expect(component.userForm.controls.full_name.value).toBe('Staff Person');
    expect(component.isInternalUser()).toBeTrue();
  });

  it('should submit trimmed editable user fields', () => {
    component.userForm.setValue({
      full_name: '  Updated Staff  ',
      role: 'staff',
      is_active: false,
    });

    component.onSubmit();

    expect(userService.updateUser).toHaveBeenCalledWith(9, {
      full_name: 'Updated Staff',
      role: 'staff',
      is_active: false,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/users']);
  });

  it('should require the administrator password before MFA reset', () => {
    component.resetMfa();

    expect(authService.adminResetMfa).not.toHaveBeenCalled();

    component.mfaResetForm.setValue({
      currentPassword: 'AdminPassword123!',
    });
    component.resetMfa();

    expect(authService.adminResetMfa).toHaveBeenCalledWith(
      9,
      'AdminPassword123!',
    );
    expect(component.mfaResetMessage()).toContain('reset');
  });

  it('should surface an update error and stop the busy state', () => {
    userService.updateUser.and.returnValue(
      throwError(() => new Error('offline')),
    );
    component.userForm.setValue({
      full_name: 'Staff Person',
      role: 'staff',
      is_active: true,
    });

    component.onSubmit();

    expect(component.errorMessage()).toContain('Unable to update user');
    expect(component.isSubmitting()).toBeFalse();
  });
});
