import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ListingService } from '../../../services/listing.service';
import { Listing, ListingUpdate } from '../../../models/listing';

@Component({
  selector: 'app-listing-edit',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './listing-edit.component.html',
  styleUrl: './listing-edit.component.css',
})
export class ListingEditComponent {
  // Read information from the current edit page URL
  private readonly route = inject(ActivatedRoute);

  // Navigate between admin pages
  private readonly router = inject(Router);

  // Store the selected listing ID from the edit page URL
  listingId: number | null = null;

  // Track whether the existing listing is loading
  isLoading = true;

  // Track whether the update request is saving
  isSubmitting = false;

  // Store a user-facing message when loading fails
  errorMessage = '';

  // Send listing requests to the FastAPI backend
  private readonly listingService = inject(ListingService);

  // Build and manage the reactive listing form
  private readonly formBuilder = inject(FormBuilder);

  // Define the edit form controls and frontend validation rules
  readonly listingForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(1)]],
    status: ['Draft', [Validators.required]],
    price: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    address: ['', [Validators.required, Validators.minLength(1)]],
    city: ['', [Validators.required, Validators.minLength(1)]],
    state: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
    ],
    description: [''],
    sqft: this.formBuilder.control<number | null>(null, [Validators.min(0)]),
    bedrooms: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    bathrooms: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    cover_image: [''],
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      // Stop loading if the edit page URL does not contain a valid listing ID
      this.errorMessage = `Invalid listing ID.`;
      this.isLoading = false;
      return;
    }
    this.listingId = id;
    this.loadListing(id);
  }

  // Load the selected listing from the backend
  private loadListing(id: number): void {
    this.listingService.getListingById(id).subscribe({
      next: (listing: Listing) => {
        // Fill the edit form with the listing values returned from the backend
        this.listingForm.patchValue({
          title: listing.title,
          status: listing.status,
          price: listing.price,
          address: listing.address,
          city: listing.city,
          state: listing.state,
          description: listing.description ?? '',
          sqft: listing.sqft,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          cover_image: listing.cover_image ?? '',
        });
        this.isLoading = false;
      },
      // Log the backend error for debugging
      error: (error) => {
        console.error(`Failed to load listing for edit:`, error);
        this.errorMessage = 'Unable to load listing. Please try again.';
        this.isLoading = false;
      },
    });
  }

  // Return to the selected listing details page
  onCancel(): void {
    if (this.listingId) {
      this.router.navigate(['/admin/listings', this.listingId]);
      return;
    }

    this.router.navigate(['/admin/listings']);
  }

  // Handle the edit form submission
  onSubmit(): void {
    if (this.listingForm.invalid) {
      // Show validation messages before stopping the submit
      this.listingForm.markAllAsTouched();
      return;
    }

    if (!this.listingId) {
      // Stop saving if the edit page does not have a valid listing ID
      this.errorMessage = 'Invalid listing ID.';
      return;
    }

    const formValue = this.listingForm.getRawValue();

    // Convert the validated form values into the format expected by FastAPI
    const listing: ListingUpdate = {
      title: formValue.title!,
      status: formValue.status!,
      price: formValue.price!,
      address: formValue.address!,
      city: formValue.city!,
      state: formValue.state!.toUpperCase(),
      description: formValue.description?.trim() || null,
      sqft: formValue.sqft,
      bedrooms: formValue.bedrooms!,
      bathrooms: formValue.bathrooms!,
      cover_image: formValue.cover_image?.trim() || null,
    };

    // Mark the form as submitting before starting the update request
    this.isSubmitting = true;

    // Send the updated listing to the FastAPI backend
    this.listingService.updateListing(this.listingId, listing).subscribe({
      next: () => {
        this.router.navigate(['/admin/listings', this.listingId]);
      },

      // Log the backend error for debugging
      error: (error) => {
        console.error('Failed to update listing:', error);
        this.errorMessage = 'Unable to update listing. Please try again.';
        this.isSubmitting = false;
      },
    });
  }
}
