import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SiteSettingsService } from '../../../services/site-settings.service';
import { SiteSettingsComponent } from './site-settings.component';

describe('SiteSettingsComponent', () => {
  let fixture: ComponentFixture<SiteSettingsComponent>;
  let component: SiteSettingsComponent;
  let service: jasmine.SpyObj<SiteSettingsService>;

  const settings = {
    site_name: 'Juniper & Lane',
    site_descriptor: 'Realty',
    tagline: 'A brighter tomorrow belongs here.',
    logo_url: null,
    phone: '515-555-0100',
    email: 'hello@example.com',
    address_line1: null,
    city: 'Ames',
    state: 'Iowa',
    postal_code: '50010',
    homepage_eyebrow: 'Local expertise',
    homepage_title: 'Find Your Place.',
    homepage_intro: 'Community-first guidance.',
    homepage_story_title: 'Rooted in community.',
    homepage_story_copy: 'Local relationships matter.',
    about_title: 'Local roots. Thoughtful guidance.',
    about_intro: 'A community-first brokerage.',
    about_mission_title: 'Our mission',
    about_mission_copy: 'Help people move with confidence.',
    about_history_title: 'Our history',
    about_history_copy: 'Built on local relationships.',
    about_image_url: null,
    about_team_title: 'Our team',
    about_team_copy: 'People who know the community.',
    contact_hours: 'Monday-Friday, 9:00 AM-5:00 PM',
    show_privacy: false,
    privacy_title: 'Privacy Policy',
    privacy_body: null,
    show_terms: false,
    terms_title: 'Terms of Use',
    terms_body: null,
    primary_color: '#13382b',
    secondary_color: '#738c78',
    show_about: true,
    show_contact: true,
    show_testimonials: false,
    enable_testimonial_submissions: false,
    enable_contact_requests: true,
    enable_showing_requests: true,
    listing_photo_max_count: 24,
    hard_listing_photo_max_count: 50,
    updated_at: null,
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<SiteSettingsService>(
      'SiteSettingsService',
      ['getAdminSettings', 'updateAdminSettings'],
    );
    service.getAdminSettings.and.returnValue(of(settings));
    service.updateAdminSettings.and.returnValue(of(settings));

    await TestBed.configureTestingModule({
      imports: [SiteSettingsComponent],
      providers: [{ provide: SiteSettingsService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(SiteSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load persisted settings into the form', () => {
    expect(component.isLoading).toBeFalse();
    expect(component.settingsForm.controls.siteName.value).toBe(
      'Juniper & Lane',
    );
    expect(component.settingsForm.controls.aboutTitle.value).toBe(
      'Local roots. Thoughtful guidance.',
    );
    expect(component.settingsForm.controls.contactHours.value).toBe(
      'Monday-Friday, 9:00 AM-5:00 PM',
    );
    expect(component.settingsForm.controls.listingPhotoMaxCount.value).toBe(24);
  });

  it('should save a validated full settings payload', () => {
    component.settingsForm.controls.siteName.setValue('Configured Realty');
    component.settingsForm.controls.showContact.setValue(false);

    component.saveSettings();

    expect(service.updateAdminSettings).toHaveBeenCalled();
    const payload = service.updateAdminSettings.calls.mostRecent().args[0];
    expect(payload.site_name).toBe('Configured Realty');
    expect(payload.show_contact).toBeFalse();
    expect(payload.about_title).toBe('Local roots. Thoughtful guidance.');
    expect(payload.contact_hours).toBe('Monday-Friday, 9:00 AM-5:00 PM');
    expect(payload.show_privacy).toBeFalse();
    expect(payload.show_terms).toBeFalse();
    expect(payload.enable_testimonial_submissions).toBeFalse();
    expect(payload.enable_contact_requests).toBeTrue();
    expect(payload.enable_showing_requests).toBeTrue();
    expect(component.successMessage).toBe('Site settings saved.');
  });

  it('should reject listing photo values above the hard maximum', () => {
    component.settingsForm.controls.listingPhotoMaxCount.setValue(51);

    component.saveSettings();

    expect(service.updateAdminSettings).not.toHaveBeenCalled();
    expect(
      component.settingsForm.controls.listingPhotoMaxCount.invalid,
    ).toBeTrue();
  });
});
