import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin, of } from 'rxjs';

import { PublicAccount } from '../../../models/auth';
import { SiteSettings } from '../../../models/site-settings';
import { AuthService } from '../../../services/auth.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicListing } from '../../models/public-listing';
import {
  PublicInquiry,
  PublicInquiryType,
} from '../../models/public-inquiry';
import { PublicInquiryService } from '../../services/public-inquiry.service';
import { PublicListingService } from '../../services/public-listing.service';

@Component({
  selector: 'app-public-contact',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './public-contact.component.html',
  styleUrl: './public-contact.component.css',
})
export class PublicContactComponent implements OnInit {
  settings: SiteSettings | null = null;
  account: PublicAccount | null = null;
  listing: PublicListing | null = null;

  inquiryType: PublicInquiryType = 'contact';
  listingId: number | null = null;

  isLoading = true;
  loadError = '';
  isSubmitting = false;
  submitError = '';
  submittedInquiry: PublicInquiry | null = null;

  private submissionKey = this.createSubmissionKey();

  readonly form;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
    private readonly settingsService: SiteSettingsService,
    private readonly listingService: PublicListingService,
    private readonly inquiryService: PublicInquiryService,
  ) {
    this.form = this.formBuilder.nonNullable.group({
      message: [''],
      preferredAt: [''],
    });
  }

  ngOnInit(): void {
    const intent = this.route.snapshot.queryParamMap.get('intent');
    this.inquiryType = intent === 'showing' ? 'showing' : 'contact';

    const rawListingId = Number(
      this.route.snapshot.queryParamMap.get('listing'),
    );
    this.listingId =
      Number.isInteger(rawListingId) && rawListingId > 0
        ? rawListingId
        : null;

    if (this.inquiryType === 'showing' && this.listingId === null) {
      this.loadError = 'Choose a listing before requesting a showing.';
      this.isLoading = false;
      return;
    }

    const isPublicUser =
      this.authService.isAuthenticated() &&
      this.authService.getUserRole() === 'public_user';

    forkJoin({
      settings: this.settingsService.getPublicSettings(),
      account: isPublicUser
        ? this.authService.getPublicAccount()
        : of(null),
      listing:
        this.listingId !== null
          ? this.listingService.getListingById(this.listingId)
          : of(null),
    }).subscribe({
      next: ({ settings, account, listing }) => {
        this.settings = settings;
        this.account = account;
        this.listing = listing;
        this.isLoading = false;
      },
      error: () => {
        this.loadError =
          'We couldn’t load the information needed for this request.';
        this.isLoading = false;
      },
    });
  }

  get featureEnabled(): boolean {
    if (!this.settings) {
      return false;
    }

    return this.inquiryType === 'showing'
      ? this.settings.enable_showing_requests
      : this.settings.enable_contact_requests;
  }

  get destinationLabel(): string {
    return (
      this.listing?.agent?.full_name ||
      this.settings?.site_name ||
      'Juniper & Lane Realty'
    );
  }

  get pageTitle(): string {
    return this.inquiryType === 'showing'
      ? 'Request a Showing'
      : this.listing
        ? 'Ask About This Home'
        : 'Contact Juniper & Lane';
  }

  submit(): void {
    if (
      !this.account ||
      !this.featureEnabled ||
      this.isSubmitting ||
      this.submittedInquiry
    ) {
      return;
    }

    const value = this.form.getRawValue();
    const message = value.message.trim();

    if (this.inquiryType === 'contact' && !message) {
      this.submitError = 'Add a message so we know how to help.';
      return;
    }

    if (message.length > 5000) {
      this.submitError = 'Keep your message under 5,000 characters.';
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    this.inquiryService
      .submit({
        inquiry_type: this.inquiryType,
        listing_id: this.listingId,
        message: message || null,
        preferred_at: value.preferredAt
          ? new Date(value.preferredAt).toISOString()
          : null,
        submission_key: this.submissionKey,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (inquiry) => {
          this.submittedInquiry = inquiry;
        },
        error: (error: HttpErrorResponse) => {
          const detail =
            typeof error.error?.detail === 'string'
              ? error.error.detail
              : '';

          if (error.status === 403 && detail.includes('verification')) {
            this.submitError =
              'Verify your email before sending contact or showing requests.';
          } else if (error.status === 403) {
            this.submitError =
              'Online requests are currently unavailable. Use the brokerage contact information below.';
          } else if (error.status === 409) {
            this.submitError =
              'This request was already submitted. Check your account dashboard for its status.';
          } else {
            this.submitError =
              'We couldn’t send your request. Please try again.';
          }
        },
      });
  }

  private createSubmissionKey(): string {
    if (
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return globalThis.crypto.randomUUID();
    }

    return `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
