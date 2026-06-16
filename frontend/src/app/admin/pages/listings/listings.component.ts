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

  // Tracks the current pagination state
  currentPage = 1;
  perPage = 10;
  totalListings = 0;

  // Tracks whether the listings request is still loading
  isLoading = false;

  // Stores an error message if the backend request fails
  errorMessage = '';

  // Runs when the Listings page loads
  ngOnInit(): void {
    this.loadListings();
  }

  // Loads the current page of listings from the backend
  loadListings(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.listingService.getListings(this.currentPage, this.perPage).subscribe({
      next: (response) => {
        this.listings = response.items;
        this.totalListings = response.total;
        this.currentPage = response.page;
        this.perPage = response.per_page;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load listings. Please try again later.';
        this.isLoading = false;
      },
    });
  }

  // Calculates the total number of listing pages
  get totalPages(): number {
    return Math.ceil(this.totalListings / this.perPage);
  }

  // Loads the previous page when one exists
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadListings();
    }
  }

  // Loads the next page when one exists
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadListings();
    }
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
