import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AnalyticsService } from '../../../services/analytics.service';
import { AuthService } from '../../../services/auth.service';
import { PrivacyConsentService } from '../../../services/privacy-consent.service';
import { SeoService } from '../../../services/seo.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicListingDocument } from '../../../models/listing-document';
import { ListingService } from '../../../services/listing.service';

import {
  ListingPreview,
  PublicListing,
  PublicListingSearchParams,
} from '../../models/public-listing';
import { ListingToolsComponent } from '../../components/listing-tools/listing-tools.component';
import { ListingEngagementService } from '../../services/listing-engagement.service';
import { PublicListingService } from '../../services/public-listing.service';

@Component({
  selector: 'app-listing-detail',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ListingToolsComponent, RouterLink],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.css',
})
export class ListingDetailComponent implements OnInit {
  listing: ListingPreview | null = null;
  similarListings: PublicListing[] = [];
  documents: PublicListingDocument[] = [];

  isLoading = true;
  documentsLoading = false;
  documentsLoadError = false;
  notFound = false;
  loadError = false;
  similarListingsLoading = false;
  mapVisible = false;

  isFavorite = false;
  favoriteBusy = false;
  favoriteError = '';
  previewMode = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly publicListingService: PublicListingService,
    private readonly listingService: ListingService,
    private readonly authService: AuthService,
    private readonly listingEngagementService: ListingEngagementService,
    private readonly analyticsService: AnalyticsService,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly seo: SeoService,
    private readonly privacyConsentService: PrivacyConsentService,
  ) {}

  ngOnInit(): void {
    this.previewMode = this.route.snapshot.data?.['preview'] === true;

    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));

      if (!Number.isInteger(id) || id <= 0) {
        this.listing = null;
        this.similarListings = [];
        this.isLoading = false;
        this.notFound = true;
        this.loadError = false;
        return;
      }

      this.loadListing(id);
    });
  }

  get canUseEngagement(): boolean {
    return (
      !this.previewMode &&
      this.authService.isAuthenticated() &&
      this.authService.getUserRole() === 'public_user'
    );
  }

  get upcomingOpenHouses() {
    return this.listing?.open_houses ?? [];
  }

  get listingLocation(): string {
    if (!this.listing) {
      return '';
    }

    return this.listing.address
      ? `${this.listing.address}, ${this.listing.city}, ${this.listing.state}`
      : `${this.listing.city}, ${this.listing.state}`;
  }

  get mapSearchUrl(): string {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(
      this.listingLocation,
    )}`;
  }

  get virtualTourLabel(): string {
    const url = this.listing?.virtual_tour_url;
    if (!url) {
      return 'Virtual Tour';
    }

    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('youtube') || host.includes('youtu.be')) {
        return 'Watch Video Tour';
      }
      if (host.includes('vimeo')) {
        return 'Watch Vimeo Tour';
      }
      if (host.includes('matterport')) {
        return 'Open Matterport Tour';
      }
    } catch {
      return 'Virtual Tour';
    }

    return 'Open Virtual Tour';
  }

  retry(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (Number.isInteger(id) && id > 0) {
      this.loadListing(id);
    }
  }

  toggleMap(): void {
    this.mapVisible = !this.mapVisible;
  }

  toggleFavorite(): void {
    if (!this.listing || !this.canUseEngagement || this.favoriteBusy) {
      return;
    }

    const listingId = this.listing.id;
    this.favoriteBusy = true;
    this.favoriteError = '';

    const request: Observable<unknown> = this.isFavorite
      ? this.listingEngagementService.removeFavorite(listingId)
      : this.listingEngagementService.addFavorite(listingId);

    request
      .pipe(finalize(() => (this.favoriteBusy = false)))
      .subscribe({
        next: () => {
          this.isFavorite = !this.isFavorite;
        },
        error: (error: HttpErrorResponse) => {
          this.favoriteError =
            error.status === 403
              ? 'Verify your email before saving homes.'
              : 'We couldn’t update your saved homes. Please try again.';
        },
      });
  }

  similarListingLocation(listing: PublicListing): string {
    return listing.address
      ? `${listing.address}, ${listing.city}, ${listing.state}`
      : `${listing.city}, ${listing.state}`;
  }

  // Load the public-safe listing that matches the route ID.
  private loadListing(id: number): void {
    this.listing = null;
    this.similarListings = [];
    this.documents = [];
    this.documentsLoading = false;
    this.documentsLoadError = false;
    this.isLoading = true;
    this.notFound = false;
    this.loadError = false;
    this.mapVisible = false;
    this.isFavorite = false;
    this.favoriteBusy = false;
    this.favoriteError = '';

    const request: Observable<ListingPreview> = this.previewMode
      ? this.listingService.getListingPreview(id)
      : this.publicListingService.getListingById(id);

    request.subscribe({
      next: (listing) => {
        this.listing = listing;
        this.isLoading = false;
        this.loadDocuments(listing.id);

        if (!this.previewMode) {
          this.updateListingSeo(listing);
          this.loadSimilarListings(listing);
          this.loadEngagementState(listing.id);
          this.recordListingView(listing.id);
        }
      },

      error: (error: HttpErrorResponse) => {
        this.isLoading = false;

        if (error.status === 404) {
          this.notFound = true;
        } else {
          this.loadError = true;
        }
      },
    });
  }

  private loadDocuments(listingId: number): void {
    this.documentsLoading = true;
    this.documentsLoadError = false;

    const request: Observable<PublicListingDocument[]> = this.previewMode
      ? new Observable<PublicListingDocument[]>((subscriber) => {
          this.listingService.getDocuments(listingId).subscribe({
            next: (documents) => {
              subscriber.next(
                documents.filter((document) => document.is_public),
              );
              subscriber.complete();
            },
            error: (error) => subscriber.error(error),
          });
        })
      : this.publicListingService.getDocuments(listingId);

    request
      .pipe(finalize(() => (this.documentsLoading = false)))
      .subscribe({
        next: (documents) => {
          this.documents = documents;
        },
        error: () => {
          this.documents = [];
          this.documentsLoadError = true;
        },
      });
  }

  private loadEngagementState(listingId: number): void {
    if (!this.canUseEngagement) {
      return;
    }

    this.listingEngagementService.getFavoriteState(listingId).subscribe({
      next: (state) => {
        this.isFavorite = state.is_favorite;
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 403) {
          this.favoriteError = 'Verify your email before saving homes.';
        }
      },
    });

    // Recently viewed is supplemental; failure should never block the listing page.
    this.listingEngagementService.recordRecentlyViewed(listingId).subscribe({
      error: () => undefined,
    });
  }

  private updateListingSeo(listing: PublicListing): void {
    // Render useful listing metadata immediately, then enrich seller identity
    // from the cached public Site Settings response when available.
    this.seo.setListing(listing);

    this.siteSettingsService.getPublicSettings().subscribe({
      next: (settings) => this.seo.setListing(listing, settings),
      error: () => undefined,
    });
  }

  private recordListingView(listingId: number): void {
    this.siteSettingsService.getPublicSettings().subscribe({
      next: (settings) => {
        const consentRequiredForAnalytics = Boolean(
          settings.privacy_consent_enabled &&
            settings.privacy_analytics_category_enabled,
        );

        if (
          consentRequiredForAnalytics &&
          !this.privacyConsentService.allowsAnalytics(settings)
        ) {
          return;
        }

        // Operational analytics are supplemental and never block listing content.
        this.analyticsService.recordListingView(listingId).subscribe({
          error: () => undefined,
        });
      },
      // Prefer skipping a view over tracking against unknown privacy settings.
      error: () => undefined,
    });
  }

  // Reuse the public browse endpoint instead of inventing a detail-only recommendations API.
  private loadSimilarListings(listing: ListingPreview): void {
    const search: PublicListingSearchParams = {
      location: listing.city,
      property_type: listing.property_type ?? undefined,
      per_page: 4,
      sort: 'newest',
    };

    this.similarListingsLoading = true;

    this.publicListingService.searchListings(search).subscribe({
      next: (response) => {
        this.similarListings = response.items
          .filter((candidate) => candidate.id !== listing.id)
          .slice(0, 3);
        this.similarListingsLoading = false;
      },
      error: () => {
        // Recommendations are supplemental; the detail page remains usable if they fail.
        this.similarListings = [];
        this.similarListingsLoading = false;
      },
    });
  }
}
