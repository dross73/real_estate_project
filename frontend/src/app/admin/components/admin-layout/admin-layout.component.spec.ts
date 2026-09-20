import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AdminLayoutComponent } from './admin-layout.component';
import { AuthService } from '../../../services/auth.service';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAdmin',
      'getUserRole',
      'logout',
    ]);
    authService.isAdmin.and.returnValue(true);
    authService.getUserRole.and.returnValue('admin');

    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
