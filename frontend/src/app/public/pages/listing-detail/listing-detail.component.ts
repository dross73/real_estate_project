import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  PublicListing,
  PublicListingSearchParams,
} from '../../models/public-listing';
import { PublicListingService } from '../../services/public-listing.service';

@Component({
  selector: 'app-listing-detail',
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.css',
})
export class ListingDetailComponent implements OnInit {
  listing: PublicListing | null = null;
  similarListings: PublicListing[] = [];

  isLoading = true;
  notFound = false;
  loadError = false;
  similarListingsLoading = false;
  mapVisible = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly publicListingService: PublicListingService,
  ) {}

  ngOnInit(): void {
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

    this.publicListingService.getListingById(id).subscribe({
      next: (listing) => {
        this.listing = listing;
        this.isLoading = false;
        this.loadSimilarListings(listing);
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

  // Reuse the public browse endpoint instead of inventing a detail-only recommendations API.
  private loadSimilarListings(listing: PublicListing): void {
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
