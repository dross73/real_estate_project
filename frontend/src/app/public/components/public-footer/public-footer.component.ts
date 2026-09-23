import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PrivacyConsentService } from '../../../services/privacy-consent.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import {
  PublicSiteBrand,
  PUBLIC_SITE_BRAND,
  publicBrandFromSettings,
} from '../../public-site.config';

@Component({
  selector: 'app-public-footer',
  imports: [RouterLink],
  templateUrl: './public-footer.component.html',
  styleUrl: './public-footer.component.css',
})
export class PublicFooterComponent implements OnInit {
  private readonly siteSettingsService = inject(SiteSettingsService);
  private readonly privacyConsentService = inject(PrivacyConsentService);

  brand: PublicSiteBrand = { ...PUBLIC_SITE_BRAND };
  logoUrl: string | null = null;
  phone: string | null = null;
  email: string | null = null;
  address = '';
  showAbout = true;
  showContact = true;
  showPrivacy = false;
  showTerms = false;
  showPrivacyChoices = false;

  readonly currentYear = new Date().getFullYear();

  ngOnInit(): void {
    this.siteSettingsService.getPublicSettings().subscribe({
      next: (settings) => {
        this.brand = publicBrandFromSettings(settings);
        this.logoUrl = settings.logo_url;
        this.phone = settings.phone;
        this.email = settings.email;
        this.address = [
          settings.address_line1,
          settings.city,
          settings.state,
          settings.postal_code,
        ]
          .filter(Boolean)
          .join(', ');
        this.showAbout = settings.show_about;
        this.showContact = settings.show_contact;
        this.showPrivacy = settings.show_privacy ?? false;
        this.showTerms = settings.show_terms ?? false;
        this.showPrivacyChoices =
          this.privacyConsentService.isConsentUiNeeded(settings);
      },
      // Static brand copy remains available if the API is temporarily unavailable.
      error: () => undefined,
    });
  }

  openPrivacyChoices(): void {
    this.privacyConsentService.requestPreferences();
  }

  get phoneHref(): string {
    return `tel:${(this.phone ?? '').replace(/[^+\d]/g, '')}`;
  }
}
