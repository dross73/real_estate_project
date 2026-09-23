import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { SiteSettings } from '../models/site-settings';

export interface PrivacyPreferences {
  version: 1;
  analytics: boolean;
  marketing: boolean;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class PrivacyConsentService {
  private readonly storageKey = 'juniper_lane_privacy_preferences_v1';
  private readonly openPreferencesSubject = new Subject<void>();

  readonly openPreferences$ = this.openPreferencesSubject.asObservable();

  // Return null when the visitor has not made a valid stored choice yet.
  getPreferences(): PrivacyPreferences | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<PrivacyPreferences>;
      if (
        parsed.version !== 1 ||
        typeof parsed.analytics !== 'boolean' ||
        typeof parsed.marketing !== 'boolean' ||
        typeof parsed.updated_at !== 'string'
      ) {
        return null;
      }

      return parsed as PrivacyPreferences;
    } catch {
      return null;
    }
  }

  savePreferences(analytics: boolean, marketing: boolean): PrivacyPreferences {
    const preferences: PrivacyPreferences = {
      version: 1,
      analytics,
      marketing,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(preferences));
    return preferences;
  }

  requestPreferences(): void {
    this.openPreferencesSubject.next();
  }

  isConsentUiNeeded(settings: SiteSettings): boolean {
    return Boolean(
      settings.privacy_consent_enabled &&
        (settings.privacy_analytics_category_enabled ||
          settings.privacy_marketing_category_enabled),
    );
  }

  // Future analytics integrations must use this boundary before initializing.
  allowsAnalytics(settings: SiteSettings): boolean {
    if (!settings.privacy_analytics_category_enabled) {
      return false;
    }

    if (!settings.privacy_consent_enabled) {
      return true;
    }

    return this.getPreferences()?.analytics === true;
  }

  // Future advertising/marketing integrations must use this boundary before initializing.
  allowsMarketing(settings: SiteSettings): boolean {
    if (!settings.privacy_marketing_category_enabled) {
      return false;
    }

    if (!settings.privacy_consent_enabled) {
      return true;
    }

    return this.getPreferences()?.marketing === true;
  }
}
