import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SiteSettingsUpdate } from '../../../models/site-settings';
import { SiteSettingsService } from '../../../services/site-settings.service';

@Component({
  selector: 'app-site-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './site-settings.component.html',
  styleUrl: './site-settings.component.css',
})
export class SiteSettingsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly siteSettingsService = inject(SiteSettingsService);

  isLoading = true;
  isSaving = false;
  loadError = '';
  saveError = '';
  successMessage = '';
  hardPhotoMax = 50;

  readonly settingsForm = this.formBuilder.nonNullable.group({
    siteName: ['Juniper & Lane', [Validators.required, Validators.maxLength(120)]],
    siteDescriptor: ['Realty', [Validators.maxLength(80)]],
    tagline: ['', [Validators.maxLength(200)]],
    logoUrl: ['', [Validators.maxLength(500)]],

    phone: ['', [Validators.maxLength(40)]],
    email: ['', [Validators.email, Validators.maxLength(320)]],
    addressLine1: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(100)]],
    state: ['', [Validators.maxLength(50)]],
    postalCode: ['', [Validators.maxLength(20)]],

    homepageEyebrow: ['', [Validators.maxLength(160)]],
    homepageTitle: ['', [Validators.maxLength(180)]],
    homepageIntro: ['', [Validators.maxLength(1200)]],
    homepageStoryTitle: ['', [Validators.maxLength(180)]],
    homepageStoryCopy: ['', [Validators.maxLength(1800)]],

    aboutTitle: ['', [Validators.maxLength(180)]],
    aboutIntro: ['', [Validators.maxLength(2400)]],
    aboutMissionTitle: ['', [Validators.maxLength(180)]],
    aboutMissionCopy: ['', [Validators.maxLength(4000)]],
    aboutHistoryTitle: ['', [Validators.maxLength(180)]],
    aboutHistoryCopy: ['', [Validators.maxLength(4000)]],
    aboutImageUrl: ['', [Validators.maxLength(2048)]],
    aboutTeamTitle: ['', [Validators.maxLength(180)]],
    aboutTeamCopy: ['', [Validators.maxLength(4000)]],

    contactHours: ['', [Validators.maxLength(2000)]],

    showPrivacy: [false],
    privacyTitle: ['Privacy Policy', [Validators.maxLength(180)]],
    privacyBody: ['', [Validators.maxLength(20000)]],
    showTerms: [false],
    termsTitle: ['Terms of Use', [Validators.maxLength(180)]],
    termsBody: ['', [Validators.maxLength(20000)]],

    privacyConsentEnabled: [false],
    privacyAnalyticsCategoryEnabled: [false],
    privacyMarketingCategoryEnabled: [false],

    requireInternalMfa: [false],

    primaryColor: [
      '#13382b',
      [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    ],
    secondaryColor: [
      '#738c78',
      [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    ],

    showAbout: [true],
    showContact: [true],
    showTestimonials: [false],
    enableTestimonialSubmissions: [false],
    enableContactRequests: [true],
    enableShowingRequests: [true],

    listingPhotoMaxCount: [
      50,
      [Validators.required, Validators.min(1), Validators.max(50)],
    ],
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.isLoading = true;
    this.loadError = '';

    this.siteSettingsService
      .getAdminSettings()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (settings) => {
          this.hardPhotoMax = settings.hard_listing_photo_max_count;
          this.settingsForm.controls.listingPhotoMaxCount.setValidators([
            Validators.required,
            Validators.min(1),
            Validators.max(this.hardPhotoMax),
          ]);

          this.settingsForm.patchValue({
            siteName: settings.site_name,
            siteDescriptor: settings.site_descriptor ?? '',
            tagline: settings.tagline ?? '',
            logoUrl: settings.logo_url ?? '',
            phone: settings.phone ?? '',
            email: settings.email ?? '',
            addressLine1: settings.address_line1 ?? '',
            city: settings.city ?? '',
            state: settings.state ?? '',
            postalCode: settings.postal_code ?? '',
            homepageEyebrow: settings.homepage_eyebrow ?? '',
            homepageTitle: settings.homepage_title ?? '',
            homepageIntro: settings.homepage_intro ?? '',
            homepageStoryTitle: settings.homepage_story_title ?? '',
            homepageStoryCopy: settings.homepage_story_copy ?? '',
            aboutTitle: settings.about_title ?? '',
            aboutIntro: settings.about_intro ?? '',
            aboutMissionTitle: settings.about_mission_title ?? '',
            aboutMissionCopy: settings.about_mission_copy ?? '',
            aboutHistoryTitle: settings.about_history_title ?? '',
            aboutHistoryCopy: settings.about_history_copy ?? '',
            aboutImageUrl: settings.about_image_url ?? '',
            aboutTeamTitle: settings.about_team_title ?? '',
            aboutTeamCopy: settings.about_team_copy ?? '',
            contactHours: settings.contact_hours ?? '',
            showPrivacy: settings.show_privacy ?? false,
            privacyTitle: settings.privacy_title ?? 'Privacy Policy',
            privacyBody: settings.privacy_body ?? '',
            showTerms: settings.show_terms ?? false,
            termsTitle: settings.terms_title ?? 'Terms of Use',
            termsBody: settings.terms_body ?? '',
            privacyConsentEnabled: settings.privacy_consent_enabled ?? false,
            privacyAnalyticsCategoryEnabled:
              settings.privacy_analytics_category_enabled ?? false,
            privacyMarketingCategoryEnabled:
              settings.privacy_marketing_category_enabled ?? false,
            requireInternalMfa: settings.require_internal_mfa ?? false,
            primaryColor: settings.primary_color,
            secondaryColor: settings.secondary_color,
            showAbout: settings.show_about,
            showContact: settings.show_contact,
            showTestimonials: settings.show_testimonials,
            enableTestimonialSubmissions:
              settings.enable_testimonial_submissions,
            enableContactRequests: settings.enable_contact_requests,
            enableShowingRequests: settings.enable_showing_requests,
            listingPhotoMaxCount: settings.listing_photo_max_count,
          });

          this.settingsForm.controls.listingPhotoMaxCount.updateValueAndValidity();
        },
        error: () => {
          this.loadError =
            'Unable to load site settings. Please try again.';
        },
      });
  }

  saveSettings(): void {
    if (this.settingsForm.invalid || this.isSaving) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    this.successMessage = '';

    this.siteSettingsService
      .updateAdminSettings(this.buildPayload())
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (settings) => {
          this.hardPhotoMax = settings.hard_listing_photo_max_count;
          this.successMessage = 'Site settings saved.';
        },
        error: () => {
          this.saveError =
            'Unable to save site settings. Review the form and try again.';
        },
      });
  }

  private buildPayload(): SiteSettingsUpdate {
    const value = this.settingsForm.getRawValue();
    const optional = (input: string): string | null =>
      input.trim() ? input.trim() : null;

    return {
      site_name: value.siteName.trim(),
      site_descriptor: optional(value.siteDescriptor),
      tagline: optional(value.tagline),
      logo_url: optional(value.logoUrl),
      phone: optional(value.phone),
      email: optional(value.email),
      address_line1: optional(value.addressLine1),
      city: optional(value.city),
      state: optional(value.state),
      postal_code: optional(value.postalCode),
      homepage_eyebrow: optional(value.homepageEyebrow),
      homepage_title: optional(value.homepageTitle),
      homepage_intro: optional(value.homepageIntro),
      homepage_story_title: optional(value.homepageStoryTitle),
      homepage_story_copy: optional(value.homepageStoryCopy),
      about_title: optional(value.aboutTitle),
      about_intro: optional(value.aboutIntro),
      about_mission_title: optional(value.aboutMissionTitle),
      about_mission_copy: optional(value.aboutMissionCopy),
      about_history_title: optional(value.aboutHistoryTitle),
      about_history_copy: optional(value.aboutHistoryCopy),
      about_image_url: optional(value.aboutImageUrl),
      about_team_title: optional(value.aboutTeamTitle),
      about_team_copy: optional(value.aboutTeamCopy),
      contact_hours: optional(value.contactHours),
      show_privacy: value.showPrivacy,
      privacy_title: optional(value.privacyTitle),
      privacy_body: optional(value.privacyBody),
      show_terms: value.showTerms,
      terms_title: optional(value.termsTitle),
      terms_body: optional(value.termsBody),
      privacy_consent_enabled: value.privacyConsentEnabled,
      privacy_analytics_category_enabled:
        value.privacyAnalyticsCategoryEnabled,
      privacy_marketing_category_enabled:
        value.privacyMarketingCategoryEnabled,
      require_internal_mfa: value.requireInternalMfa,
      primary_color: value.primaryColor.trim().toLowerCase(),
      secondary_color: value.secondaryColor.trim().toLowerCase(),
      show_about: value.showAbout,
      show_contact: value.showContact,
      show_testimonials: value.showTestimonials,
      enable_testimonial_submissions: value.enableTestimonialSubmissions,
      enable_contact_requests: value.enableContactRequests,
      enable_showing_requests: value.enableShowingRequests,
      listing_photo_max_count: value.listingPhotoMaxCount,
    };
  }
}
