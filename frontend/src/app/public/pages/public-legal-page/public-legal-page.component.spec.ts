import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SiteSettings } from '../../../models/site-settings';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicLegalPageComponent } from './public-legal-page.component';

describe('PublicLegalPageComponent', () => {
  let fixture: ComponentFixture<PublicLegalPageComponent>;
  let component: PublicLegalPageComponent;
  let service: jasmine.SpyObj<SiteSettingsService>;

  const settings = {
    site_name: 'Juniper & Lane',
    site_descriptor: 'Realty',
    tagline: null,
    logo_url: null,
    phone: null,
    email: null,
    address_line1: null,
    city: null,
    state: null,
    postal_code: null,
    homepage_eyebrow: null,
    homepage_title: null,
    homepage_intro: null,
    homepage_story_title: null,
    homepage_story_copy: null,
    primary_color: '#13382b',
    secondary_color: '#738c78',
    show_about: true,
    show_contact: true,
    show_testimonials: false,
    enable_testimonial_submissions: false,
    enable_contact_requests: true,
    enable_showing_requests: true,
    show_privacy: true,
    privacy_title: 'Our Privacy Policy',
    privacy_body: 'We explain what information this site uses.',
    show_terms: false,
    terms_title: 'Terms of Use',
    terms_body: null,
    listing_photo_max_count: 50,
    hard_listing_photo_max_count: 50,
    updated_at: null,
  } as SiteSettings;

  beforeEach(async () => {
    service = jasmine.createSpyObj<SiteSettingsService>('SiteSettingsService', [
      'getPublicSettings',
    ]);
    service.getPublicSettings.and.returnValue(of(settings));

    await TestBed.configureTestingModule({
      imports: [PublicLegalPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { page: 'privacy' } } },
        },
        { provide: SiteSettingsService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicLegalPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show enabled privacy content', () => {
    expect(component.enabled).toBeTrue();
    expect(component.title).toBe('Our Privacy Policy');
    expect(component.body).toContain('what information');
    expect(fixture.nativeElement.textContent).toContain('Our Privacy Policy');
  });

  it('should hide the legal body when the page is disabled', () => {
    component.enabled = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Page unavailable');
    expect(fixture.nativeElement.textContent).not.toContain(
      'We explain what information',
    );
  });
});
