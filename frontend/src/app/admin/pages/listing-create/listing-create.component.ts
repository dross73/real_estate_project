import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ListingService } from '../../../services/listing.service';
import { ListingCreate } from '../../../models/listing';

@Component({
  selector: 'app-listing-create',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './listing-create.component.html',
  styleUrl: './listing-create.component.css',
})
export class ListingCreateComponent {
  // Build and manage the reactive listing form.
  private readonly formBuilder = inject(FormBuilder);

  // Navigate between admin pages
  private readonly router = inject(Router);

  // Send listing requests to the FastAPI backend.
  private readonly listingService = inject(ListingService);

  // Track whether the create request is currently being processed. 
  isSubmitting = false;

  // Define the form controls and frontend validation rules.
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

  // Return to the listings page.
  onCancel(): void {
    this.router.navigate(['admin/listings']);
  }
  // Handle the form submission.
  onSubmit(): void {
    if (this.listingForm.invalid) {
      this.listingForm.markAllAsTouched();
      return;
    }

    const formValue = this.listingForm.getRawValue();

    // Convert the validated form values into the format expected by FastAPI.
    const listing: ListingCreate = {
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

    // Mark the form as submitting before starting the backend request.
    this.isSubmitting = true;

    // Send the completed listing to the FastAPI backend.
    this.listingService.createListing(listing).subscribe({
      next: () => {
        this.router.navigate(['/admin/listings']);
      },

      // Log the backend error for debugging.
      error: (error) => {
        console.error('Failed to create listing:', error);
        this.isSubmitting = false;
      },
    });
  }
}
