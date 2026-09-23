import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SiteSettings } from '../../../models/site-settings';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicAboutComponent } from './public-about.component';

describe('PublicAboutComponent', () => {
  let fixture: ComponentFixture<PublicAboutComponent>;
  let component: PublicAboutComponent;
  let service: jasmine.SpyObj<SiteSettingsService>;

  const settings = {
    site_name: 'Juniper & Lane',
    site_descriptor: 'Realty',
    tagline: 'A brighter tomorrow belongs here.',
    logo_url: null,
    phone: null,
    email: null,
    address_line1: null,
    city: 'Ames',
    state: 'IA',
    postal_code: null,
    homepage_eyebrow: null,
    homepage_title: null,
    homepage_intro: null,
    homepage_story_title: null,
    homepage_story_copy: null,
    about_title: 'Local roots. Thoughtful guidance.',
    about_intro: 'A community-first brokerage.',
    about_mission_title: 'Our mission',
    about_mission_copy: 'Help people move with confidence.',
    about_history_title: 'Our history',
    about_history_copy: 'Built on local relationships.',
    about_image_url: null,
    about_team_title: 'Our team',
    about_team_copy: 'People who know the community.',
    primary_color: '#13382b',
    secondary_color: '#738c78',
    show_about: true,
    show_contact: true,
    show_testimonials: false,
    enable_testimonial_submissions: false,
    enable_contact_requests: true,
    enable_showing_requests: true,
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
      imports: [PublicAboutComponent],
      providers: [
        provideRouter([]),
        { provide: SiteSettingsService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render configured About content when enabled', () => {
    expect(component.pageVisible).toBeTrue();
    expect(component.settings?.about_title).toBe(
      'Local roots. Thoughtful guidance.',
    );
    expect(fixture.nativeElement.textContent).toContain('Our mission');
  });

  it('should treat the About page as unavailable when disabled', () => {
    component.settings = {
      ...settings,
      show_about: false,
    };
    fixture.detectChanges();

    expect(component.pageVisible).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain(
      'About page unavailable',
    );
  });
});
