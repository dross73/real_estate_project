import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicHeaderComponent } from './public-header.component';

describe('PublicHeaderComponent', () => {
  let component: PublicHeaderComponent;
  let fixture: ComponentFixture<PublicHeaderComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let siteSettingsService: jasmine.SpyObj<SiteSettingsService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated',
      'getUserRole',
      'logout',
    ]);
    authService.isAuthenticated.and.returnValue(false);
    authService.getUserRole.and.returnValue(null);

    siteSettingsService = jasmine.createSpyObj<SiteSettingsService>(
      'SiteSettingsService',
      ['getPublicSettings'],
    );
    siteSettingsService.getPublicSettings.and.returnValue(of({
      site_name: 'Juniper & Lane',
      site_descriptor: 'Realty',
      tagline: 'A brighter tomorrow belongs here.',
      logo_url: null,
      phone: null,
      email: null,
      address_line1: null,
      city: null,
      state: null,
      postal_code: null,
      homepage_eyebrow: 'Homes rooted in a brighter tomorrow',
      homepage_title: 'Local People. Lasting Places.',
      homepage_intro: 'Community-first guidance.',
      homepage_story_title: 'Rooted in community.',
      homepage_story_copy: 'Local relationships matter.',
      primary_color: '#13382b',
      secondary_color: '#738c78',
      show_about: true,
      show_contact: true,
      show_testimonials: false,\n      enable_contact_requests: true,\n      enable_showing_requests: true,
      listing_photo_max_count: 50,
      hard_listing_photo_max_count: 50,
      updated_at: null,
    }));

    await TestBed.configureTestingModule({
      imports: [PublicHeaderComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: SiteSettingsService, useValue: siteSettingsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should honor configurable navigation visibility', () => {
    siteSettingsService.getPublicSettings.and.returnValue(
      of({
        ...{
      site_name: 'Juniper & Lane',
      site_descriptor: 'Realty',
      tagline: 'A brighter tomorrow belongs here.',
      logo_url: null,
      phone: null,
      email: null,
      address_line1: null,
      city: null,
      state: null,
      postal_code: null,
      homepage_eyebrow: 'Homes rooted in a brighter tomorrow',
      homepage_title: 'Local People. Lasting Places.',
      homepage_intro: 'Community-first guidance.',
      homepage_story_title: 'Rooted in community.',
      homepage_story_copy: 'Local relationships matter.',
      primary_color: '#13382b',
      secondary_color: '#738c78',
      show_about: true,
      show_contact: true,
      show_testimonials: false,\n      enable_contact_requests: true,\n      enable_showing_requests: true,
      listing_photo_max_count: 50,
      hard_listing_photo_max_count: 50,
      updated_at: null,
    },
        site_name: 'Configured Realty',
        show_about: false,
        show_contact: false,
      }),
    );

    const configuredFixture = TestBed.createComponent(PublicHeaderComponent);
    configuredFixture.detectChanges();
    const configured = configuredFixture.componentInstance;

    expect(configured.brand.name).toBe('Configured Realty');
    expect(configured.showAbout).toBeFalse();
    expect(configured.showContact).toBeFalse();
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
