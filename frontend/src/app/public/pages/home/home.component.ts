import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PROPERTY_TYPES } from '../../../models/listing';
import { PublicTestimonial } from '../../../models/testimonial';
import { PublicListing } from '../../models/public-listing';
import {
  PublicHomeContent,
  PUBLIC_HOME_CONTENT,
  publicHomeContentFromSettings,
} from '../../public-site.config';
import { PublicListingService } from '../../services/public-listing.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { TestimonialService } from '../../../services/testimonial.service';

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
  content: PublicHomeContent = PUBLIC_HOME_CONTENT;
  readonly propertyTypes = PROPERTY_TYPES;

  showAbout = true;
  showContact = true;
  showTestimonials = false;
  enableTestimonialSubmissions = false;

  testimonials: PublicTestimonial[] = [];
  testimonialsLoading = false;
  testimonialsLoadError = false;

  featuredListings: PublicListing[] = [];
  isLoadingFeatured = true;
  featuredLoadError = false;

  readonly searchForm: FormGroup;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly publicListingService: PublicListingService,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly testimonialService: TestimonialService,
    private readonly router: Router,
  ) {
    // Initialize after Angular has assigned the injected FormBuilder.
    this.searchForm = this.formBuilder.nonNullable.group({
      location: '',
      minPrice: '',
      maxPrice: '',
      bedrooms: '',
      propertyType: '',
    });
  }

  ngOnInit(): void {
    this.loadSiteSettings();
    this.loadFeaturedListings();
  }

  private loadSiteSettings(): void {
    this.siteSettingsService.getPublicSettings().subscribe({
      next: (settings) => {
        this.content = publicHomeContentFromSettings(settings);
        this.showAbout = settings.show_about;
        this.showContact = settings.show_contact;
        this.showTestimonials = settings.show_testimonials;
        this.enableTestimonialSubmissions =
          settings.enable_testimonial_submissions;

        if (this.showTestimonials) {
          this.loadTestimonials();
        }
      },
      // Approved static homepage copy remains the fallback.
      error: () => undefined,
    });
  }

  loadTestimonials(): void {
    this.testimonialsLoading = true;
    this.testimonialsLoadError = false;

    this.testimonialService
      .getPublicTestimonials(6)
      .pipe(finalize(() => (this.testimonialsLoading = false)))
      .subscribe({
        next: (testimonials) => {
          this.testimonials = testimonials;
        },
        error: () => {
          this.testimonials = [];
          this.testimonialsLoadError = true;
        },
      });
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
