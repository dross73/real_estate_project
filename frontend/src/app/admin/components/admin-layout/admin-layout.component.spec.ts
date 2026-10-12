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

  it('should expose mobile navigation state and close it with Escape', () => {
    const openButton = fixture.nativeElement.querySelector(
      'button[aria-controls="admin-navigation"]',
    ) as HTMLButtonElement;

    expect(openButton.getAttribute('aria-expanded')).toBe('false');

    component.toggleSidebar();
    fixture.detectChanges();

    expect(openButton.getAttribute('aria-expanded')).toBe('true');
    expect(component.isSidebarOpen).toBeTrue();

    component.onEscape();
    fixture.detectChanges();

    expect(component.isSidebarOpen).toBeFalse();
    expect(openButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('should use the security page title for the security route', () => {
    component.updatePageTitle('/admin/security');

    expect(component.pageTitle).toBe('Security');
  });

  it('should use the analytics page title for the analytics route', () => {
    component.updatePageTitle('/admin/analytics');

    expect(component.pageTitle).toBe('Analytics');
  });
  it('shows the persistent read-only banner and only approved navigation for viewers', () => {
    authService.isAdmin.and.returnValue(false);
    authService.getUserRole.and.returnValue('viewer');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Demo Access — Read Only');
    const links = Array.from(fixture.nativeElement.querySelectorAll('nav a')) as HTMLAnchorElement[];
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/admin/dashboard', '/admin/listings']);
  });

  for (const role of ['staff', 'admin']) {
    it(`does not show the viewer banner for ${role}`, () => {
      authService.getUserRole.and.returnValue(role as 'staff' | 'admin');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Demo Access — Read Only');
    });
  }

});
