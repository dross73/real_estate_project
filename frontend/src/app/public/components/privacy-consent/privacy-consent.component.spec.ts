import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SiteSettings } from '../../../models/site-settings';
import { PrivacyConsentService } from '../../../services/privacy-consent.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PrivacyConsentComponent } from './privacy-consent.component';

describe('PrivacyConsentComponent', () => {
  let fixture: ComponentFixture<PrivacyConsentComponent>;
  let component: PrivacyConsentComponent;
  let settingsService: jasmine.SpyObj<SiteSettingsService>;
  let consentService: PrivacyConsentService;

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
    privacy_consent_enabled: true,
    privacy_analytics_category_enabled: true,
    privacy_marketing_category_enabled: true,
    listing_photo_max_count: 50,
    hard_listing_photo_max_count: 50,
    updated_at: null,
  } as SiteSettings;

  beforeEach(async () => {
    localStorage.clear();

    settingsService = jasmine.createSpyObj<SiteSettingsService>(
      'SiteSettingsService',
      ['getPublicSettings'],
    );
    settingsService.getPublicSettings.and.returnValue(of(settings));

    await TestBed.configureTestingModule({
      imports: [PrivacyConsentComponent],
      providers: [
        provideRouter([]),
        { provide: SiteSettingsService, useValue: settingsService },
      ],
    }).compileComponents();

    consentService = TestBed.inject(PrivacyConsentService);
    fixture = TestBed.createComponent(PrivacyConsentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should show a choice banner when consent controls are enabled and no choice exists', () => {
    expect(component.showBanner).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Privacy choices');
  });

  it('should save accepted optional categories and hide the banner', () => {
    component.acceptOptional();

    const stored = consentService.getPreferences();
    expect(stored?.analytics).toBeTrue();
    expect(stored?.marketing).toBeTrue();
    expect(component.showBanner).toBeFalse();
  });

  it('should save rejection and allow the preferences panel to be reopened later', () => {
    component.rejectOptional();

    expect(consentService.getPreferences()?.analytics).toBeFalse();
    expect(consentService.getPreferences()?.marketing).toBeFalse();

    consentService.requestPreferences();

    expect(component.showPanel).toBeTrue();
  });

  it('should persist custom category choices independently', () => {
    component.openPreferences();
    component.analyticsChoice = true;
    component.marketingChoice = false;

    component.saveCustomPreferences();

    expect(consentService.getPreferences()?.analytics).toBeTrue();
    expect(consentService.getPreferences()?.marketing).toBeFalse();
  });
});
