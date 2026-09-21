import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { PublicHeaderComponent } from './public-header.component';

describe('PublicHeaderComponent', () => {
  let component: PublicHeaderComponent;
  let fixture: ComponentFixture<PublicHeaderComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated',
      'getUserRole',
      'logout',
    ]);
    authService.isAuthenticated.and.returnValue(false);
    authService.getUserRole.and.returnValue(null);
    await TestBed.configureTestingModule({
      imports: [PublicHeaderComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the mobile menu', () => {
    component.toggleMenu();
    expect(component.isMenuOpen).toBeTrue();

    component.closeMenu();
    expect(component.isMenuOpen).toBeFalse();
  });

  it('should expose account actions only for signed-in public users', () => {
    expect(component.isPublicUser).toBeFalse();

    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');

    expect(component.isPublicUser).toBeTrue();
  });
});
