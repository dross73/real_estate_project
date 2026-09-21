import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { PublicListing } from '../../models/public-listing';
import { SavedSearch, SavedSearchAlertFrequency } from '../../models/saved-search';
import { ListingEngagementService } from '../../services/listing-engagement.service';
import { SavedSearchService } from '../../services/saved-search.service';

@Component({
  selector: 'app-saved-homes',
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './saved-homes.component.html',
  styleUrl: './saved-homes.component.css',
})
export class SavedHomesComponent implements OnInit {
  favorites: PublicListing[] = [];
  recentlyViewed: PublicListing[] = [];
  savedSearches: SavedSearch[] = [];

  editingSearchId: number | null = null;
  editSearchName = '';
  editSearchFrequency: SavedSearchAlertFrequency = 'daily';

  isLoading = false;
  loadError = false;
  accessError = '';
  removingIds = new Set<number>();
  searchBusyIds = new Set<number>();

  constructor(
    private readonly authService: AuthService,
    private readonly listingEngagementService: ListingEngagementService,
    private readonly savedSearchService: SavedSearchService,
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
      savedSearches: this.savedSearchService.list(),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ favorites, recentlyViewed, savedSearches }) => {
          this.favorites = favorites.items;
          this.recentlyViewed = recentlyViewed.items;
          this.savedSearches = savedSearches.items;
        },
        error: (error) => {
          this.favorites = [];
          this.recentlyViewed = [];
          this.savedSearches = [];

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

  beginEditSearch(search: SavedSearch): void {
    this.editingSearchId = search.id;
    this.editSearchName = search.name;
    this.editSearchFrequency = search.alert_frequency;
  }

  cancelEditSearch(): void {
    this.editingSearchId = null;
  }

  saveSearchEdits(search: SavedSearch): void {
    const name = this.editSearchName.trim();
    if (!name || this.searchBusyIds.has(search.id)) {
      return;
    }

    this.searchBusyIds.add(search.id);
    this.savedSearchService
      .update(search.id, {
        name,
        alert_frequency: this.editSearchFrequency,
      })
      .pipe(finalize(() => this.searchBusyIds.delete(search.id)))
      .subscribe({
        next: (updated) => {
          this.replaceSavedSearch(updated);
          this.editingSearchId = null;
        },
        error: () => {
          this.accessError = 'We couldn’t update that saved search. Please try again.';
        },
      });
  }

  toggleSearchAlerts(search: SavedSearch): void {
    if (this.searchBusyIds.has(search.id)) {
      return;
    }

    this.searchBusyIds.add(search.id);
    this.savedSearchService
      .update(search.id, { alerts_enabled: !search.alerts_enabled })
      .pipe(finalize(() => this.searchBusyIds.delete(search.id)))
      .subscribe({
        next: (updated) => this.replaceSavedSearch(updated),
        error: () => {
          this.accessError = 'We couldn’t change that alert preference. Please try again.';
        },
      });
  }

  deleteSavedSearch(searchId: number): void {
    if (this.searchBusyIds.has(searchId)) {
      return;
    }

    this.searchBusyIds.add(searchId);
    this.savedSearchService
      .delete(searchId)
      .pipe(finalize(() => this.searchBusyIds.delete(searchId)))
      .subscribe({
        next: () => {
          this.savedSearches = this.savedSearches.filter(
            (search) => search.id !== searchId,
          );
        },
        error: () => {
          this.accessError = 'We couldn’t delete that saved search. Please try again.';
        },
      });
  }

  savedSearchQueryParams(search: SavedSearch): Record<string, string | number> {
    return {
      ...search.criteria,
      saved_search_id: search.id,
    };
  }

  savedSearchSummary(search: SavedSearch): string {
    const criteria = search.criteria;
    const parts: string[] = [];

    if (criteria.location) parts.push(criteria.location);
    if (criteria.property_type) parts.push(criteria.property_type);
    if (criteria.min_bedrooms !== undefined) {
      parts.push(`${criteria.min_bedrooms}+ beds`);
    }
    if (criteria.max_price !== undefined) {
      parts.push(`up to ${criteria.max_price.toLocaleString()}`);
    }
    if (criteria.status) parts.push(criteria.status);

    return parts.length > 0 ? parts.join(' · ') : 'All public homes';
  }

  private replaceSavedSearch(updated: SavedSearch): void {
    this.savedSearches = this.savedSearches.map((search) =>
      search.id === updated.id ? updated : search,
    );
  }

  listingLocation(listing: PublicListing): string {
    return listing.address
      ? `${listing.address}, ${listing.city}, ${listing.state}`
      : `${listing.city}, ${listing.state}`;
  }
}
