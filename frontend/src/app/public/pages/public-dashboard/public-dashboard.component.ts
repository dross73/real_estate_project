import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { PublicAccount } from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';
import { PublicListing } from '../../models/public-listing';
import { SavedSearch } from '../../models/saved-search';
import { ListingEngagementService } from '../../services/listing-engagement.service';
import { SavedSearchService } from '../../services/saved-search.service';

@Component({
  selector: 'app-public-dashboard',
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './public-dashboard.component.html',
  styleUrl: './public-dashboard.component.css',
})
export class PublicDashboardComponent implements OnInit {
  account: PublicAccount | null = null;
  favorites: PublicListing[] = [];
  recentlyViewed: PublicListing[] = [];
  savedSearches: SavedSearch[] = [];

  isLoading = true;
  loadError = false;

  constructor(
    private readonly authService: AuthService,
    private readonly engagementService: ListingEngagementService,
    private readonly savedSearchService: SavedSearchService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  get enabledAlertCount(): number {
    return this.savedSearches.filter((search) => search.alerts_enabled).length;
  }

  get firstName(): string {
    const name = this.account?.full_name?.trim();
    return name ? name.split(/\s+/)[0] : 'there';
  }

  get favoritePreview(): PublicListing[] {
    return this.favorites.slice(0, 3);
  }

  get recentPreview(): PublicListing[] {
    return this.recentlyViewed.slice(0, 3);
  }

  get searchPreview(): SavedSearch[] {
    return this.savedSearches.slice(0, 3);
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.loadError = false;

    forkJoin({
      account: this.authService.getPublicAccount(),
      favorites: this.engagementService.getFavorites(),
      recentlyViewed: this.engagementService.getRecentlyViewed(6),
      savedSearches: this.savedSearchService.list(),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ account, favorites, recentlyViewed, savedSearches }) => {
          this.account = account;
          this.favorites = favorites.items;
          this.recentlyViewed = recentlyViewed.items;
          this.savedSearches = savedSearches.items;
        },
        error: () => {
          this.loadError = true;
        },
      });
  }

  savedSearchQueryParams(
    search: SavedSearch,
  ): Record<string, string | number | undefined> {
    return {
      ...search.criteria,
      saved_search_id: search.id,
    };
  }

  savedSearchSummary(search: SavedSearch): string {
    const parts: string[] = [];
    const criteria = search.criteria;

    if (criteria.location) parts.push(criteria.location);
    if (criteria.property_type) parts.push(criteria.property_type);
    if (criteria.min_bedrooms !== undefined) {
      parts.push(`${criteria.min_bedrooms}+ beds`);
    }
    if (criteria.max_price !== undefined) {
      parts.push(`up to $${criteria.max_price.toLocaleString()}`);
    }

    return parts.length > 0 ? parts.join(' · ') : 'All public homes';
  }

  listingLocation(listing: PublicListing): string {
    return listing.address
      ? `${listing.address}, ${listing.city}, ${listing.state}`
      : `${listing.city}, ${listing.state}`;
  }
}
