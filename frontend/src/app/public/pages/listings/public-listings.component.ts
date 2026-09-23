import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PROPERTY_TYPES, PropertyType } from '../../../models/listing';
import { AuthService } from '../../../services/auth.service';
import { SeoService } from '../../../services/seo.service';
import {
  PublicListing,
  PublicListingSearchParams,
  PublicListingSort,
  PublicListingStatus,
} from '../../models/public-listing';
import {
  SavedSearchAlertFrequency,
  SavedSearchCriteria,
} from '../../models/saved-search';
import { PublicListingService } from '../../services/public-listing.service';
import { SavedSearchService } from '../../services/saved-search.service';

type ListingsViewMode = 'grid' | 'list';

interface ListingFilterFormValue {
  location: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  minBathrooms: string;
  propertyType: string;
  minSqft: string;
  maxSqft: string;
  minAcreage: string;
  maxAcreage: string;
  minYearBuilt: string;
  maxYearBuilt: string;
  status: string;
}

@Component({
  selector: 'app-public-listings',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './public-listings.component.html',
  styleUrl: './public-listings.component.css',
})
export class PublicListingsComponent implements OnInit {
  readonly propertyTypes = PROPERTY_TYPES;
  readonly statuses: PublicListingStatus[] = ['Active', 'Pending', 'Sold'];
  readonly sortOptions: { value: PublicListingSort; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'beds_desc', label: 'Most Bedrooms' },
    { value: 'baths_desc', label: 'Most Bathrooms' },
    { value: 'sqft_desc', label: 'Largest Home' },
  ];

  readonly filterForm: FormGroup;

  listings: PublicListing[] = [];
  total = 0;
  page = 1;
  perPage = 12;
  sort: PublicListingSort = 'newest';

  isLoading = true;
  loadError = false;
  filterValidationMessage = '';

  filtersOpen = false;
  mapVisible = false;
  viewMode: ListingsViewMode = 'grid';

  activeSavedSearchId: number | null = null;
  saveSearchFormOpen = false;
  saveSearchName = '';
  saveSearchFrequency: SavedSearchAlertFrequency = 'daily';
  saveSearchBusy = false;
  saveSearchMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly publicListingService: PublicListingService,
    private readonly authService: AuthService,
    private readonly seo: SeoService,
    private readonly savedSearchService: SavedSearchService,
  ) {
    this.filterForm = this.formBuilder.nonNullable.group({
      location: '',
      minPrice: '',
      maxPrice: '',
      minBedrooms: '',
      minBathrooms: '',
      propertyType: '',
      minSqft: '',
      maxSqft: '',
      minAcreage: '',
      maxAcreage: '',
      minYearBuilt: '',
      maxYearBuilt: '',
      status: '',
    });
  }

  ngOnInit(): void {
    // The URL is the source of truth so homepage searches, refreshes, and sharing work.
    this.route.queryParamMap.subscribe((params) => {
      this.syncFormFromRoute(params);
      this.updateSeo(params);

      const search = this.searchFromRoute(params);
      this.page = search.page ?? 1;
      this.perPage = search.per_page ?? 12;
      this.sort = search.sort ?? 'newest';
      this.activeSavedSearchId = this.positiveIntegerFromParam(
        params,
        'saved_search_id',
      );

      this.loadListings(search);
    });
  }

  private updateSeo(params: ParamMap): void {
    const location = params.get('location')?.trim();
    const title = location
      ? `Homes for Sale in ${location}`
      : 'Homes for Sale';
    const description = location
      ? `Browse current real estate listings in ${location} with filters for price, property type, bedrooms, and more.`
      : 'Browse current homes and real estate listings with filters for location, price, property type, bedrooms, and more.';

    this.seo.setPage({
      title,
      description,
      path: '/listings',
    });
  }

  applyFilters(): void {
    const value = this.filterForm.getRawValue();

    if (!this.filtersAreValid(value)) {
      return;
    }

    this.filterValidationMessage = '';

    const queryParams: Record<string, string | number> = {
      page: 1,
      per_page: this.perPage,
      sort: this.sort,
    };

    if (this.activeSavedSearchId !== null) {
      queryParams['saved_search_id'] = this.activeSavedSearchId;
    }

    this.addTextParam(queryParams, 'location', value.location);
    this.addNumberParam(queryParams, 'min_price', value.minPrice);
    this.addNumberParam(queryParams, 'max_price', value.maxPrice);
    this.addNumberParam(queryParams, 'min_bedrooms', value.minBedrooms);
    this.addNumberParam(queryParams, 'min_bathrooms', value.minBathrooms);
    this.addTextParam(queryParams, 'property_type', value.propertyType);
    this.addNumberParam(queryParams, 'min_sqft', value.minSqft);
    this.addNumberParam(queryParams, 'max_sqft', value.maxSqft);
    this.addNumberParam(queryParams, 'min_acreage', value.minAcreage);
    this.addNumberParam(queryParams, 'max_acreage', value.maxAcreage);
    this.addNumberParam(queryParams, 'min_year_built', value.minYearBuilt);
    this.addNumberParam(queryParams, 'max_year_built', value.maxYearBuilt);
    this.addTextParam(queryParams, 'status', value.status);

    this.filtersOpen = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }

  clearFilters(): void {
    this.filterValidationMessage = '';
    this.filtersOpen = false;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: 1,
        per_page: this.perPage,
        sort: this.sort,
        ...(this.activeSavedSearchId !== null
          ? { saved_search_id: this.activeSavedSearchId }
          : {}),
      },
    });
  }

  changeSort(sort: PublicListingSort): void {
    this.sort = sort;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sort,
        page: 1,
      },
      queryParamsHandling: 'merge',
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  setViewMode(mode: ListingsViewMode): void {
    this.viewMode = mode;
    this.mapVisible = false;
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  toggleMap(): void {
    this.mapVisible = !this.mapVisible;
  }

  retry(): void {
    this.loadListings(this.searchFromRoute(this.route.snapshot.queryParamMap));
  }

  get canSaveSearch(): boolean {
    return (
      this.authService.isAuthenticated() &&
      this.authService.getUserRole() === 'public_user'
    );
  }

  openSaveSearchForm(): void {
    this.saveSearchMessage = '';

    if (!this.canSaveSearch) {
      return;
    }

    this.saveSearchName =
      this.filterForm.getRawValue().location.trim() || 'My home search';
    this.saveSearchFrequency = 'daily';
    this.saveSearchFormOpen = true;
  }

  closeSaveSearchForm(): void {
    this.saveSearchFormOpen = false;
    this.saveSearchMessage = '';
  }

  createSavedSearch(): void {
    const name = this.saveSearchName.trim();

    if (!this.canSaveSearch || !name || this.saveSearchBusy) {
      return;
    }

    this.saveSearchBusy = true;
    this.saveSearchMessage = '';

    this.savedSearchService
      .create({
        name,
        criteria: this.currentSavedSearchCriteria(),
        alert_frequency: this.saveSearchFrequency,
        alerts_enabled: true,
      })
      .pipe(finalize(() => (this.saveSearchBusy = false)))
      .subscribe({
        next: (savedSearch) => {
          this.activeSavedSearchId = savedSearch.id;
          this.saveSearchFormOpen = false;
          this.saveSearchMessage = 'Search saved. New matching homes can now trigger alerts.';

          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { saved_search_id: savedSearch.id },
            queryParamsHandling: 'merge',
          });
        },
        error: (error) => {
          this.saveSearchMessage =
            error.status === 409
              ? 'You already have a saved search with that name.'
              : error.status === 403
                ? 'Verify your email before saving searches.'
                : 'We couldn’t save this search. Please try again.';
        },
      });
  }

  updateActiveSavedSearch(): void {
    if (
      !this.canSaveSearch ||
      this.activeSavedSearchId === null ||
      this.saveSearchBusy
    ) {
      return;
    }

    this.saveSearchBusy = true;
    this.saveSearchMessage = '';

    this.savedSearchService
      .update(this.activeSavedSearchId, {
        criteria: this.currentSavedSearchCriteria(),
      })
      .pipe(finalize(() => (this.saveSearchBusy = false)))
      .subscribe({
        next: () => {
          this.saveSearchMessage = 'Saved search updated with these filters.';
        },
        error: (error) => {
          this.saveSearchMessage =
            error.status === 404
              ? 'That saved search no longer exists.'
              : error.status === 403
                ? 'Verify your email before updating saved searches.'
                : 'We couldn’t update this saved search. Please try again.';
        },
      });
  }

  listingLocation(listing: PublicListing): string {
    return listing.address
      ? `${listing.address}, ${listing.city}, ${listing.state}`
      : `${listing.city}, ${listing.state}`;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.perPage));
  }

  get resultSummary(): string {
    if (this.total === 0) {
      return 'No homes found';
    }

    return `${this.total} ${this.total === 1 ? 'home' : 'homes'} found`;
  }

  private loadListings(search: PublicListingSearchParams): void {
    this.isLoading = true;
    this.loadError = false;

    this.publicListingService
      .searchListings(search)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.listings = response.items;
          this.total = response.total;
          this.page = response.page;
          this.perPage = response.per_page;
        },
        error: () => {
          this.listings = [];
          this.total = 0;
          this.loadError = true;
        },
      });
  }

  private syncFormFromRoute(params: ParamMap): void {
    this.filterForm.patchValue(
      {
        location: params.get('location') ?? '',
        minPrice: params.get('min_price') ?? '',
        maxPrice: params.get('max_price') ?? '',
        minBedrooms: params.get('min_bedrooms') ?? '',
        minBathrooms: params.get('min_bathrooms') ?? '',
        propertyType: params.get('property_type') ?? '',
        minSqft: params.get('min_sqft') ?? '',
        maxSqft: params.get('max_sqft') ?? '',
        minAcreage: params.get('min_acreage') ?? '',
        maxAcreage: params.get('max_acreage') ?? '',
        minYearBuilt: params.get('min_year_built') ?? '',
        maxYearBuilt: params.get('max_year_built') ?? '',
        status: params.get('status') ?? '',
      },
      { emitEvent: false },
    );
  }

  private searchFromRoute(params: ParamMap): PublicListingSearchParams {
    return {
      page: this.numberFromParam(params, 'page') ?? 1,
      per_page: this.numberFromParam(params, 'per_page') ?? 12,
      min_price: this.numberFromParam(params, 'min_price'),
      max_price: this.numberFromParam(params, 'max_price'),
      min_bedrooms: this.numberFromParam(params, 'min_bedrooms'),
      min_bathrooms: this.numberFromParam(params, 'min_bathrooms'),
      location: this.textFromParam(params, 'location'),
      property_type: this.propertyTypeFromParam(params),
      min_sqft: this.numberFromParam(params, 'min_sqft'),
      max_sqft: this.numberFromParam(params, 'max_sqft'),
      min_acreage: this.numberFromParam(params, 'min_acreage'),
      max_acreage: this.numberFromParam(params, 'max_acreage'),
      min_year_built: this.numberFromParam(params, 'min_year_built'),
      max_year_built: this.numberFromParam(params, 'max_year_built'),
      status: this.statusFromParam(params),
      sort: this.sortFromParam(params),
    };
  }

  private currentSavedSearchCriteria(): SavedSearchCriteria {
    const search = this.searchFromRoute(this.route.snapshot.queryParamMap);

    return {
      min_price: search.min_price,
      max_price: search.max_price,
      min_bedrooms: search.min_bedrooms,
      min_bathrooms: search.min_bathrooms,
      location: search.location,
      property_type: search.property_type,
      min_sqft: search.min_sqft,
      max_sqft: search.max_sqft,
      min_acreage: search.min_acreage,
      max_acreage: search.max_acreage,
      min_year_built: search.min_year_built,
      max_year_built: search.max_year_built,
      status: search.status,
    };
  }

  private positiveIntegerFromParam(
    params: ParamMap,
    key: string,
  ): number | null {
    const value = params.get(key);
    const parsed = value === null ? Number.NaN : Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private numberFromParam(params: ParamMap, key: string): number | undefined {
    const value = params.get(key);

    if (value === null || value.trim() === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private textFromParam(params: ParamMap, key: string): string | undefined {
    const value = params.get(key)?.trim();
    return value ? value : undefined;
  }

  private propertyTypeFromParam(params: ParamMap): PropertyType | undefined {
    const value = params.get('property_type');
    return PROPERTY_TYPES.includes(value as PropertyType)
      ? (value as PropertyType)
      : undefined;
  }

  private statusFromParam(params: ParamMap): PublicListingStatus | undefined {
    const value = params.get('status');
    return this.statuses.includes(value as PublicListingStatus)
      ? (value as PublicListingStatus)
      : undefined;
  }

  private sortFromParam(params: ParamMap): PublicListingSort {
    const value = params.get('sort') as PublicListingSort | null;

    return this.sortOptions.some((option) => option.value === value)
      ? (value as PublicListingSort)
      : 'newest';
  }

  private addTextParam(
    target: Record<string, string | number>,
    key: string,
    value: string,
  ): void {
    const trimmed = value.trim();
    if (trimmed) {
      target[key] = trimmed;
    }
  }

  private addNumberParam(
    target: Record<string, string | number>,
    key: string,
    value: string,
  ): void {
    if (value !== '' && Number.isFinite(Number(value))) {
      target[key] = Number(value);
    }
  }

  private filtersAreValid(value: ListingFilterFormValue): boolean {
    const ranges: Array<[string, string, string]> = [
      [value.minPrice, value.maxPrice, 'Minimum price cannot exceed maximum price.'],
      [value.minSqft, value.maxSqft, 'Minimum square footage cannot exceed maximum square footage.'],
      [value.minAcreage, value.maxAcreage, 'Minimum acreage cannot exceed maximum acreage.'],
      [value.minYearBuilt, value.maxYearBuilt, 'Minimum year cannot exceed maximum year.'],
    ];

    for (const [minimum, maximum, message] of ranges) {
      if (
        minimum !== '' &&
        maximum !== '' &&
        Number(minimum) > Number(maximum)
      ) {
        this.filterValidationMessage = message;
        return false;
      }
    }

    return true;
  }
}
