import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { UserService } from '../../../services/user.service';
import { UserCreateComponent } from './user-create.component';

describe('UserCreateComponent', () => {
  let fixture: ComponentFixture<UserCreateComponent>;
  let component: UserCreateComponent;
  let userService: jasmine.SpyObj<UserService>;
  let router: Router;

  beforeEach(async () => {
    userService = jasmine.createSpyObj<UserService>('UserService', [
      'createUser',
    ]);
    userService.createUser.and.returnValue(
      of({
        id: 7,
        email: 'new@example.com',
        full_name: 'New Staff',
        is_active: true,
        archived_at: null,
        role: 'staff',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [UserCreateComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: userService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCreateComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  it('should reject an invalid user form without calling the API', () => {
    component.onSubmit();

    expect(component.userForm.touched).toBeTrue();
    expect(userService.createUser).not.toHaveBeenCalled();
  });

  it('should normalize and submit a valid internal user', () => {
    component.userForm.setValue({
      full_name: '  New Staff  ',
      email: '  NEW@EXAMPLE.COM  ',
      password: 'Password123!',
      role: 'staff',
      is_active: true,
    });

    component.onSubmit();

    expect(userService.createUser).toHaveBeenCalledWith({
      full_name: 'New Staff',
      email: 'new@example.com',
      password: 'Password123!',
      role: 'staff',
      is_active: true,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/users']);
  });

  it('should surface a create error and allow another submission', () => {
    userService.createUser.and.returnValue(
      throwError(() => new Error('conflict')),
    );
    component.userForm.setValue({
      full_name: 'New Staff',
      email: 'new@example.com',
      password: 'Password123!',
      role: 'staff',
      is_active: true,
    });

    component.onSubmit();

    expect(component.errorMessage()).toContain('Unable to create user');
    expect(component.isSubmitting()).toBeFalse();
  });
});
