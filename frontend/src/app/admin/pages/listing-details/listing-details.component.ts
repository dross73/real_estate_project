import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  effectiveListingVisibility,
  Listing,
  OpenHouseEvent,
} from '../../../models/listing';
import { ListingService } from '../../../services/listing.service';

@Component({
  selector: 'app-listing-details',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './listing-details.component.html',
  styleUrl: './listing-details.component.css',
})
export class ListingDetailsComponent implements OnInit {
  // Provides access to values stored in the current route
  private readonly route = inject(ActivatedRoute);

  // Sends the admin back to the listing page after delete succeeds
  private readonly router = inject(Router);

  // Sends listing requests to the FastAPI backend
  private readonly listingService = inject(ListingService);

  // Builds the small open-house scheduling form.
  private readonly formBuilder = inject(FormBuilder);

  // Stores the listing returned by the backend
  listing: Listing | null = null;

  // Tracks whether the listing request is still loading
  isLoading = true;

  // Stores an error message if the listing request fails
  errorMessage = '';

  // Tracks whether the delete request is currently running
  isDeleting = false;

  // Listing open-house schedule and independent UI state.
  openHouses: OpenHouseEvent[] = [];
  isOpenHouseLoading = false;
  isOpenHouseSaving = false;
  deletingOpenHouseId: number | null = null;
  editingOpenHouseId: number | null = null;
  openHouseError = '';

  readonly openHouseForm = this.formBuilder.nonNullable.group({
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
  });

  // Runs when the listing details page loads
  ngOnInit(): void {
    const listingId = Number(this.route.snapshot.paramMap.get('id'));

    // Stop if the route does not contain a valid listing ID
    if (!Number.isInteger(listingId) || listingId <= 0) {
      this.errorMessage = 'Unable to load listing';
      this.isLoading = false;
      return;
    }

    // Request the selected listing from the backend
    this.listingService.getListingById(listingId).subscribe({
      next: (response) => {
        this.listing = response;
        this.isLoading = false;
        this.loadOpenHouses(response.id);
      },
      error: () => {
        this.errorMessage = 'Unable to load listing. Please try again later';
        this.isLoading = false;
      },
    });
  }
  visibilityLabel(listing: Listing): string {
    return effectiveListingVisibility(listing);
  }

  get upcomingOpenHouses(): OpenHouseEvent[] {
    const now = Date.now();
    return this.openHouses.filter(
      (event) => new Date(event.ends_at).getTime() > now,
    );
  }

  get pastOpenHouses(): OpenHouseEvent[] {
    const now = Date.now();
    return this.openHouses.filter(
      (event) => new Date(event.ends_at).getTime() <= now,
    );
  }

  saveOpenHouse(): void {
    if (!this.listing || this.isOpenHouseSaving) {
      return;
    }

    this.openHouseForm.markAllAsTouched();
    if (this.openHouseForm.invalid) {
      this.openHouseError = 'Choose both a start time and an end time.';
      return;
    }

    const value = this.openHouseForm.getRawValue();
    const startsAt = new Date(value.startsAt);
    const endsAt = new Date(value.endsAt);

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt.getTime() <= Date.now()
    ) {
      this.openHouseError = 'Open houses must start in the future.';
      return;
    }

    if (endsAt <= startsAt) {
      this.openHouseError = 'The end time must be after the start time.';
      return;
    }

    const payload = {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    };

    this.isOpenHouseSaving = true;
    this.openHouseError = '';

    const request = this.editingOpenHouseId
      ? this.listingService.updateOpenHouse(
          this.listing.id,
          this.editingOpenHouseId,
          payload,
        )
      : this.listingService.createOpenHouse(this.listing.id, payload);

    request
      .pipe(finalize(() => (this.isOpenHouseSaving = false)))
      .subscribe({
        next: (event) => {
          const existingIndex = this.openHouses.findIndex(
            (candidate) => candidate.id === event.id,
          );

          if (existingIndex >= 0) {
            this.openHouses = this.openHouses.map((candidate) =>
              candidate.id === event.id ? event : candidate,
            );
          } else {
            this.openHouses = [...this.openHouses, event];
          }

          this.sortOpenHouses();
          this.cancelOpenHouseEdit();
        },
        error: () => {
          this.openHouseError =
            'Unable to save the open house. Check the times and try again.';
        },
      });
  }

  editOpenHouse(event: OpenHouseEvent): void {
    this.editingOpenHouseId = event.id;
    this.openHouseError = '';
    this.openHouseForm.setValue({
      startsAt: this.toLocalInputValue(event.starts_at),
      endsAt: this.toLocalInputValue(event.ends_at),
    });
  }

  cancelOpenHouseEdit(): void {
    this.editingOpenHouseId = null;
    this.openHouseForm.reset({
      startsAt: '',
      endsAt: '',
    });
  }

  deleteOpenHouse(event: OpenHouseEvent): void {
    if (!this.listing || this.deletingOpenHouseId !== null) {
      return;
    }

    const confirmed = window.confirm(
      'Remove this open-house time from the listing?',
    );
    if (!confirmed) {
      return;
    }

    this.deletingOpenHouseId = event.id;
    this.openHouseError = '';

    this.listingService
      .deleteOpenHouse(this.listing.id, event.id)
      .pipe(finalize(() => (this.deletingOpenHouseId = null)))
      .subscribe({
        next: () => {
          this.openHouses = this.openHouses.filter(
            (candidate) => candidate.id !== event.id,
          );
          if (this.editingOpenHouseId === event.id) {
            this.cancelOpenHouseEdit();
          }
        },
        error: () => {
          this.openHouseError =
            'Unable to remove the open house. Please try again.';
        },
      });
  }

  private loadOpenHouses(listingId: number): void {
    this.isOpenHouseLoading = true;
    this.openHouseError = '';

    this.listingService
      .getOpenHouses(listingId)
      .pipe(finalize(() => (this.isOpenHouseLoading = false)))
      .subscribe({
        next: (events) => {
          this.openHouses = events;
          this.sortOpenHouses();
        },
        error: () => {
          this.openHouseError =
            'Unable to load the open-house schedule right now.';
        },
      });
  }

  private sortOpenHouses(): void {
    this.openHouses = [...this.openHouses].sort(
      (left, right) =>
        new Date(left.starts_at).getTime() -
        new Date(right.starts_at).getTime(),
    );
  }

  private toLocalInputValue(value: string): string {
    const date = new Date(value);
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60_000,
    );
    return local.toISOString().slice(0, 16);
  }

  // Deletes the current listing after the admin confirms the action
  deleteListing(): void {
    if (!this.listing) {
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete "${this.listing.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    // Prevents duplicate delete requests while the backend call is running
    this.isDeleting = true;

    this.listingService.deleteListing(this.listing.id).subscribe({
      next: () => {
        // Sends the admin back to the listings page after delete succeeds
        this.router.navigate(['/admin/listings']);
      },
      error: () => {
        // Re-enables delete and shows a user-friendly error
        this.isDeleting = false;
        this.errorMessage = 'Unable to delete listings. Please try again.';
      },
    });
  }
}
