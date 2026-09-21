import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { UsersComponent } from './users.component';
import { UserService } from '../../../services/user.service';

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    userService = jasmine.createSpyObj<UserService>('UserService', ['getUsers']);
    userService.getUsers.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: userService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(userService.getUsers).toHaveBeenCalled();
  });

  it('should label archived accounts separately from inactive accounts', () => {
    expect(
      component.userStatusLabel({
        id: 7,
        email: 'archived@example.com',
        full_name: 'Archived User',
        is_active: false,
        archived_at: '2026-09-21T20:00:00Z',
        role: 'public_user',
      }),
    ).toBe('Archived');
  });
});
