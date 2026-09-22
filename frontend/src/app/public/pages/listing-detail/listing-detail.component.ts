import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';
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

  isLoading = true;
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

        if (!this.previewMode) {
          this.loadSimilarListings(listing);
          this.loadEngagementState(listing.id);
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
