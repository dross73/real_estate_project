import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { PublicListing } from '../../models/public-listing';
import { ListingEngagementService } from '../../services/listing-engagement.service';

@Component({
  selector: 'app-saved-homes',
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './saved-homes.component.html',
  styleUrl: './saved-homes.component.css',
})
export class SavedHomesComponent implements OnInit {
  favorites: PublicListing[] = [];
  recentlyViewed: PublicListing[] = [];

  isLoading = false;
  loadError = false;
  accessError = '';
  removingIds = new Set<number>();

  constructor(
    private readonly authService: AuthService,
    private readonly listingEngagementService: ListingEngagementService,
  ) {}

  ngOnInit(): void {
    if (this.canUseEngagement) {
      this.loadCollections();
    }
  }

  get canUseEngagement(): boolean {
    return (
      this.authService.isAuthenticated() &&
      this.authService.getUserRole() === 'public_user'
    );
  }

  loadCollections(): void {
    if (!this.canUseEngagement) {
      return;
    }

    this.isLoading = true;
    this.loadError = false;
    this.accessError = '';

    forkJoin({
      favorites: this.listingEngagementService.getFavorites(),
      recentlyViewed: this.listingEngagementService.getRecentlyViewed(),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ favorites, recentlyViewed }) => {
          this.favorites = favorites.items;
          this.recentlyViewed = recentlyViewed.items;
        },
        error: (error) => {
          this.favorites = [];
          this.recentlyViewed = [];

          if (error.status === 403) {
            this.accessError =
              'Verify your email before using saved homes and recently viewed listings.';
          } else {
            this.loadError = true;
          }
        },
      });
  }

  removeFavorite(listingId: number): void {
    if (!this.canUseEngagement || this.removingIds.has(listingId)) {
      return;
    }

    this.removingIds.add(listingId);
    this.accessError = '';

    this.listingEngagementService
      .removeFavorite(listingId)
      .pipe(finalize(() => this.removingIds.delete(listingId)))
      .subscribe({
        next: () => {
          this.favorites = this.favorites.filter(
            (listing) => listing.id !== listingId,
          );
        },
        error: (error) => {
          this.accessError =
            error.status === 403
              ? 'Verify your email before changing saved homes.'
              : 'We couldn’t update your saved homes. Please try again.';
        },
      });
  }

  listingLocation(listing: PublicListing): string {
    return listing.address
      ? `${listing.address}, ${listing.city}, ${listing.state}`
      : `${listing.city}, ${listing.state}`;
  }
}
