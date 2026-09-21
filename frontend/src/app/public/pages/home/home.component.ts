import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PROPERTY_TYPES } from '../../../models/listing';
import { PublicListing } from '../../models/public-listing';
import {
  PUBLIC_HOME_CONTENT,
  PUBLIC_SITE_BRAND,
} from '../../public-site.config';
import { PublicListingService } from '../../services/public-listing.service';

@Component({
  selector: 'app-home',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  readonly brand = PUBLIC_SITE_BRAND;
  readonly content = PUBLIC_HOME_CONTENT;
  readonly propertyTypes = PROPERTY_TYPES;

  featuredListings: PublicListing[] = [];
  isLoadingFeatured = true;
  featuredLoadError = false;

  readonly searchForm = this.formBuilder.nonNullable.group({
    location: '',
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    propertyType: '',
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly publicListingService: PublicListingService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadFeaturedListings();
  }

  // Keep homepage search inputs compatible with the public listing API query names.
  searchListings(): void {
    const value = this.searchForm.getRawValue();

    const queryParams: Record<string, string> = {};

    if (value.location.trim()) {
      queryParams['location'] = value.location.trim();
    }
    if (value.minPrice) {
      queryParams['min_price'] = value.minPrice;
    }
    if (value.maxPrice) {
      queryParams['max_price'] = value.maxPrice;
    }
    if (value.bedrooms) {
      queryParams['min_bedrooms'] = value.bedrooms;
    }
    if (value.propertyType) {
      queryParams['property_type'] = value.propertyType;
    }

    void this.router.navigate(['/listings'], { queryParams });
  }

  // Load explicitly featured, public-safe listings for homepage merchandising.
  loadFeaturedListings(): void {
    this.isLoadingFeatured = true;
    this.featuredLoadError = false;

    this.publicListingService
      .getFeaturedListings(4)
      .pipe(finalize(() => (this.isLoadingFeatured = false)))
      .subscribe({
        next: (listings) => {
          this.featuredListings = listings;
        },
        error: () => {
          this.featuredListings = [];
          this.featuredLoadError = true;
        },
      });
  }

  listingLocation(listing: PublicListing): string {
    if (listing.address) {
      return `${listing.address}, ${listing.city}, ${listing.state}`;
    }

    return `${listing.city}, ${listing.state}`;
  }
}
