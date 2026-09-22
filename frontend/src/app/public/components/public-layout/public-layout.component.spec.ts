import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicLayoutComponent } from './public-layout.component';

describe('PublicLayoutComponent', () => {
  let component: PublicLayoutComponent;
  let fixture: ComponentFixture<PublicLayoutComponent>;
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
      show_testimonials: false,
      enable_contact_requests: true,
      enable_showing_requests: true,
      listing_photo_max_count: 50,
      hard_listing_photo_max_count: 50,
      updated_at: null,
    }));

    await TestBed.configureTestingModule({
      imports: [PublicLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: SiteSettingsService, useValue: siteSettingsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply configured brand colors to the public shell', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.style.getPropertyValue('--public-color-forest')).toBe('#13382b');
    expect(host.style.getPropertyValue('--public-color-sage')).toBe('#738c78');
  });
});
