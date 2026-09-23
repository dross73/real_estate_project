import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SiteSettings } from '../../../models/site-settings';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicFooterComponent } from './public-footer.component';

describe('PublicFooterComponent', () => {
  let fixture: ComponentFixture<PublicFooterComponent>;
  let component: PublicFooterComponent;
  let service: jasmine.SpyObj<SiteSettingsService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj<SiteSettingsService>('SiteSettingsService', [
      'getPublicSettings',
    ]);
    service.getPublicSettings.and.returnValue(
      of({
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
        show_terms: false,
        listing_photo_max_count: 50,
        hard_listing_photo_max_count: 50,
        updated_at: null,
      } as SiteSettings),
    );

    await TestBed.configureTestingModule({
      imports: [PublicFooterComponent],
      providers: [
        provideRouter([]),
        { provide: SiteSettingsService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicFooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should reflect optional legal-page visibility', () => {
    expect(component.showPrivacy).toBeTrue();
    expect(component.showTerms).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Privacy Policy');
    expect(fixture.nativeElement.textContent).not.toContain('Terms of Use');
  });
});
