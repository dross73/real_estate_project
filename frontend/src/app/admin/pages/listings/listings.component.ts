import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Listing } from '../../../models/listing';
import { ListingService } from '../../../services/listing.service';

@Component({
  selector: 'app-listings',
  imports: [CommonModule, FormsModule],
  templateUrl: './listings.component.html',
  styleUrl: './listings.component.css',
})
export class ListingsComponent implements OnInit {
  constructor(private listingService: ListingService) {}

  // Stores the current text typed into the listing search input
  searchTerm = '';

  // Stores the listing data loaded from the FastAPI backend
  listings: Listing[] = [];

  // Tracks whether the listings request is still loading
  isLoading = false;

  // Stores an error message if the backend request fails
  errorMessage = '';

  // Runs when the Listings page loads
  ngOnInit(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.listingService.getListings().subscribe({
      next: (response) => {
        this.listings = response.items;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load listings. Please try again later.';
        this.isLoading = false;
      },
    });
  }

  // Returns listings that match the current search term
  // This keeps the filtering logic in TypeScript instead of cluttering the HTML
  get filteredListings(): typeof this.listings {
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      return this.listings;
    }

    return this.listings.filter((listing) => {
      return (
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term) ||
        listing.status.toLowerCase().includes(term)
      );
    });
  }
}
