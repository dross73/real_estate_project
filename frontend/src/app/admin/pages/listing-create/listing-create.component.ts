import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  HOA_FEE_FREQUENCIES,
  HoaFeeFrequency,
  LISTING_STATUSES,
  ListingCreate,
  ListingStatus,
  isPubliclyEligibleStatus,
  MAX_LISTING_ACREAGE,
  MAX_LISTING_BATHROOMS,
  MAX_LISTING_BEDROOMS,
  MAX_LISTING_MONEY_FIELD,
  MAX_LISTING_PRICE,
  MAX_LISTING_SQFT,
  PROPERTY_TYPES,
  PropertyType,
} from '../../../models/listing';
import { ListingService } from '../../../services/listing.service';

@Component({
  selector: 'app-listing-create',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './listing-create.component.html',
  styleUrl: './listing-create.component.css',
})
export class ListingCreateComponent implements OnInit {
  // Build and manage the reactive listing form.
  private readonly formBuilder = inject(FormBuilder);

  // Navigate between admin pages.
  private readonly router = inject(Router);

  // Send listing requests to the FastAPI backend.
  private readonly listingService = inject(ListingService);

  // Options shared with backend validation.
  readonly statusOptions = LISTING_STATUSES;
  readonly propertyTypeOptions = PROPERTY_TYPES;
  readonly hoaFrequencyOptions = HOA_FEE_FREQUENCIES;
  readonly maxYearBuilt = new Date().getFullYear() + 1;

  // Track whether the create request is currently being processed.
  isSubmitting = false;

  // Store a user-friendly save error.
  errorMessage = '';

  // Define the full launch-ready listing form.
  readonly listingForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(150)]],
    status: ['Draft', [Validators.required]],
    is_public: [false],
    is_featured: [false],
    hide_exact_address: [false],

    price: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(MAX_LISTING_PRICE),
    ]),
    property_type: [''],

    address: ['', [Validators.required, Validators.maxLength(255)]],
    city: ['', [Validators.required, Validators.maxLength(100)]],
    state: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
    ],

    bedrooms: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(MAX_LISTING_BEDROOMS),
    ]),
    bathrooms: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(MAX_LISTING_BATHROOMS),
    ]),
    sqft: this.formBuilder.control<number | null>(null, [
      Validators.min(0),
      Validators.max(MAX_LISTING_SQFT),
    ]),
    acreage: this.formBuilder.control<number | null>(null, [
      Validators.min(0),
      Validators.max(MAX_LISTING_ACREAGE),
    ]),
    year_built: this.formBuilder.control<number | null>(null, [
      Validators.min(1600),
      Validators.max(this.maxYearBuilt),
    ]),

    annual_property_taxes: this.formBuilder.control<number | null>(null, [
      Validators.min(0),
      Validators.max(MAX_LISTING_MONEY_FIELD),
    ]),
    hoa_fee: this.formBuilder.control<number | null>(null, [
      Validators.min(0),
      Validators.max(MAX_LISTING_MONEY_FIELD),
    ]),
    hoa_fee_frequency: [''],

    school_district: ['', [Validators.maxLength(150)]],
    amenities: [''],

    mls_number: ['', [Validators.maxLength(100)]],
    source_attribution: ['', [Validators.maxLength(255)]],
    cover_image: [''],
    description: ['', [Validators.maxLength(20_000)]],
  });

  ngOnInit(): void {
    this.listingForm.controls.status.valueChanges.subscribe((status) => {
      this.syncPublicVisibilityControl(status as ListingStatus);
    });
    this.syncPublicVisibilityControl(
      this.listingForm.controls.status.value as ListingStatus,
    );
  }

  get canShowPublicly(): boolean {
    return isPubliclyEligibleStatus(
      this.listingForm.controls.status.value as ListingStatus,
    );
  }

  private syncPublicVisibilityControl(status: ListingStatus): void {
    const control = this.listingForm.controls.is_public;

    if (!isPubliclyEligibleStatus(status)) {
      control.setValue(false, { emitEvent: false });
      control.disable({ emitEvent: false });
      return;
    }

    control.enable({ emitEvent: false });
  }

  // Return to the listings page.
  onCancel(): void {
    this.router.navigate(['/admin/listings']);
  }

  // Convert comma-separated UI input into structured backend amenities.
  private parseAmenities(value: string | null): string[] {
    if (!value) {
      return [];
    }

    const seen = new Set<string>();

    return value
      .split(',')
      .map((amenity) => amenity.trim())
      .filter((amenity) => {
        if (!amenity) {
          return false;
        }

        const key = amenity.toLowerCase();
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  }

  // Convert a text control into a trimmed nullable API value.
  private nullableText(value: string | null): string | null {
    return value?.trim() || null;
  }

  // Handle the form submission.
  onSubmit(): void {
    if (this.listingForm.invalid) {
      this.listingForm.markAllAsTouched();
      return;
    }

    const formValue = this.listingForm.getRawValue();

    const listing: ListingCreate = {
      title: formValue.title!.trim(),
      status: formValue.status as ListingStatus,
      is_public: Boolean(formValue.is_public),
      is_featured: Boolean(formValue.is_featured),
      hide_exact_address: Boolean(formValue.hide_exact_address),

      price: formValue.price!,
      property_type: (formValue.property_type || null) as PropertyType | null,

      address: formValue.address!.trim(),
      city: formValue.city!.trim(),
      state: formValue.state!.trim().toUpperCase(),

      description: this.nullableText(formValue.description),
      sqft: formValue.sqft,
      acreage: formValue.acreage,
      year_built: formValue.year_built,

      bedrooms: formValue.bedrooms!,
      bathrooms: formValue.bathrooms!,

      annual_property_taxes: formValue.annual_property_taxes,
      hoa_fee: formValue.hoa_fee,
      hoa_fee_frequency: (formValue.hoa_fee_frequency ||
        null) as HoaFeeFrequency | null,

      school_district: this.nullableText(formValue.school_district),
      amenities: this.parseAmenities(formValue.amenities),

      mls_number: this.nullableText(formValue.mls_number),
      source_attribution: this.nullableText(formValue.source_attribution),
      cover_image: this.nullableText(formValue.cover_image),
    };

    this.isSubmitting = true;
    this.errorMessage = '';

    this.listingService.createListing(listing).subscribe({
      next: () => {
        this.router.navigate(['/admin/listings']);
      },
      error: () => {
        this.errorMessage = 'Unable to create listing. Please try again.';
        this.isSubmitting = false;
      },
    });
  }
}
