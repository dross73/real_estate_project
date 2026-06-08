import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common'; 

@Component({
  selector: 'app-listing-create',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './listing-create.component.html',
  styleUrl: './listing-create.component.css',
})
export class ListingCreateComponent {
  // Build and manage the reactive listing form.
  private readonly formBuilder = inject(FormBuilder);

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

  // Handle the form submission.
  onSubmit(): void {
    if (this.listingForm.invalid) {
      this.listingForm.markAllAsTouched();
      return;
    }

    console.log(this.listingForm.getRawValue());

  }
}
