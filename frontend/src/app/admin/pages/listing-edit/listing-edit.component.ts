import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AgentProfile } from '../../../models/agent';
import {
  HOA_FEE_FREQUENCIES,
  HoaFeeFrequency,
  LISTING_STATUSES,
  Listing,
  ListingStatus,
  ListingUpdate,
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
import { AgentService } from '../../../services/agent.service';
import { ListingService } from '../../../services/listing.service';
import { ListingPhotoUploadComponent } from '../../components/listing-photo-upload/listing-photo-upload.component';

@Component({
  selector: 'app-listing-edit',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ListingPhotoUploadComponent],
  templateUrl: './listing-edit.component.html',
  styleUrl: './listing-edit.component.css',
})
export class ListingEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly agentService = inject(AgentService);
  private readonly formBuilder = inject(FormBuilder);

  listingId: number | null = null;
  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  agents: AgentProfile[] = [];

  readonly statusOptions = LISTING_STATUSES;
  readonly propertyTypeOptions = PROPERTY_TYPES;
  readonly hoaFrequencyOptions = HOA_FEE_FREQUENCIES;
  readonly maxYearBuilt = new Date().getFullYear() + 1;

  readonly listingForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(150)]],
    status: ['Draft', [Validators.required]],
    is_public: [false],
    is_featured: [false],
    hide_exact_address: [false],
    agent_id: this.formBuilder.control<number | null>(null),

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
    this.loadAssignableAgents();

    this.listingForm.controls.status.valueChanges.subscribe((status) => {
      this.syncPublicVisibilityControl(status as ListingStatus);
    });
    this.syncPublicVisibilityControl(
      this.listingForm.controls.status.value as ListingStatus,
    );

    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id <= 0) {
      this.errorMessage = 'Invalid listing ID.';
      this.isLoading = false;
      return;
    }

    this.listingId = id;
    this.loadListing(id);
  }

  private loadListing(id: number): void {
    this.listingService.getListingById(id).subscribe({
      next: (listing: Listing) => {
        this.listingForm.patchValue({
          title: listing.title,
          status: listing.status,
          is_public: listing.is_public,
          is_featured: listing.is_featured,
          hide_exact_address: listing.hide_exact_address,
          agent_id: listing.agent_id,

          price: listing.price,
          property_type: listing.property_type ?? '',

          address: listing.address,
          city: listing.city,
          state: listing.state,

          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          sqft: listing.sqft,
          acreage: listing.acreage,
          year_built: listing.year_built,

          annual_property_taxes: listing.annual_property_taxes,
          hoa_fee: listing.hoa_fee,
          hoa_fee_frequency: listing.hoa_fee_frequency ?? '',

          school_district: listing.school_district ?? '',
          amenities: listing.amenities.join(', '),

          mls_number: listing.mls_number ?? '',
          source_attribution: listing.source_attribution ?? '',
          cover_image: listing.cover_image ?? '',
          description: listing.description ?? '',
        });

        this.syncPublicVisibilityControl(listing.status);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load listing. Please try again.';
        this.isLoading = false;
      },
    });
  }

  private loadAssignableAgents(): void {
    this.agentService.getAgents(true).subscribe({
      next: (agents) => {
        this.agents = agents;
      },
      error: () => {
        this.agents = [];
      },
    });
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

  onCancel(): void {
    if (this.listingId) {
      this.router.navigate(['/admin/listings', this.listingId]);
      return;
    }

    this.router.navigate(['/admin/listings']);
  }

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

  private nullableText(value: string | null): string | null {
    return value?.trim() || null;
  }

  onSubmit(): void {
    if (this.listingForm.invalid) {
      this.listingForm.markAllAsTouched();
      return;
    }

    if (!this.listingId) {
      this.errorMessage = 'Invalid listing ID.';
      return;
    }

    const formValue = this.listingForm.getRawValue();

    const listing: ListingUpdate = {
      title: formValue.title!.trim(),
      status: formValue.status as ListingStatus,
      is_public: Boolean(formValue.is_public),
      is_featured: Boolean(formValue.is_featured),
      hide_exact_address: Boolean(formValue.hide_exact_address),
      agent_id: formValue.agent_id ?? null,

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

    this.listingService.updateListing(this.listingId, listing).subscribe({
      next: () => {
        this.router.navigate(['/admin/listings', this.listingId]);
      },
      error: () => {
        this.errorMessage = 'Unable to update listing. Please try again.';
        this.isSubmitting = false;
      },
    });
  }
}
