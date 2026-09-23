import { TestBed } from '@angular/core/testing';

import { SiteSettings } from '../models/site-settings';
import { PrivacyConsentService } from './privacy-consent.service';

describe('PrivacyConsentService', () => {
  let service: PrivacyConsentService;

  const settings = {
    privacy_consent_enabled: true,
    privacy_analytics_category_enabled: true,
    privacy_marketing_category_enabled: true,
  } as SiteSettings;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrivacyConsentService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return no preference before the visitor makes a choice', () => {
    expect(service.getPreferences()).toBeNull();
  });

  it('should persist independent optional-category choices', () => {
    service.savePreferences(true, false);

    const stored = service.getPreferences();

    expect(stored?.analytics).toBeTrue();
    expect(stored?.marketing).toBeFalse();
    expect(stored?.version).toBe(1);
  });

  it('should block optional integrations until consent is granted when controls are enabled', () => {
    expect(service.allowsAnalytics(settings)).toBeFalse();
    expect(service.allowsMarketing(settings)).toBeFalse();

    service.savePreferences(true, false);

    expect(service.allowsAnalytics(settings)).toBeTrue();
    expect(service.allowsMarketing(settings)).toBeFalse();
  });

  it('should not require the consent UI when only essential storage is configured', () => {
    const essentialOnly = {
      ...settings,
      privacy_analytics_category_enabled: false,
      privacy_marketing_category_enabled: false,
    };

    expect(service.isConsentUiNeeded(essentialOnly)).toBeFalse();
  });

  it('should allow an enabled optional integration without a prompt when consent controls are disabled', () => {
    const noConsentPrompt = {
      ...settings,
      privacy_consent_enabled: false,
      privacy_marketing_category_enabled: false,
    };

    expect(service.allowsAnalytics(noConsentPrompt)).toBeTrue();
    expect(service.allowsMarketing(noConsentPrompt)).toBeFalse();
  });
});
