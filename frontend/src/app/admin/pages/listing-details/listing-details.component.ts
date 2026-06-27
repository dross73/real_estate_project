import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Listing } from '../../../models/listing';
import { ListingService } from '../../../services/listing.service';

@Component({
  selector: 'app-listing-details',
  imports: [CommonModule, RouterLink],
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

  // Stores the listing returned by the backend
  listing: Listing | null = null;

  // Tracks whether the listing request is still loading
  isLoading = true;

  // Stores an error message if the listing request fails
  errorMessage = '';

  // Tracks whether the delete request is currently running
  isDeleting = false;

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
      },
      error: () => {
        this.errorMessage = 'Unable to load listing. Please try again later';
        this.isLoading = false;
      },
    });
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
