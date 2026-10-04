import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  effectiveListingVisibility,
  LISTING_STATUSES,
  Listing,
  ListingStatus,
} from '../../../models/listing';
import { ListingService } from '../../../services/listing.service';

type ListingStatusFilter = 'All' | ListingStatus;

@Component({
  selector: 'app-listings',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './listings.component.html',
  styleUrl: './listings.component.css',
})
export class ListingsComponent implements OnInit {
  constructor(private listingService: ListingService) {}

  searchTerm = '';
  statusFilter: ListingStatusFilter = 'All';
  readonly statusOptions: ListingStatusFilter[] = ['All', ...LISTING_STATUSES];

  listings: Listing[] = [];

  currentPage = 1;
  perPage = 10;
  totalListings = 0;

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadListings();
  }

  loadListings(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.listingService
      .getListings(
        this.currentPage,
        this.perPage,
        this.searchTerm.trim(),
        this.statusFilter === 'All' ? '' : this.statusFilter,
      )
      .subscribe({
        next: (response) => {
          this.listings = response.items;
          this.totalListings = response.total;
          this.currentPage = response.page;
          this.perPage = response.per_page;
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage =
            'Unable to load listings. Please try again later.';
          this.isLoading = false;
        },
      });
  }
  onFiltersChange(): void {
    this.currentPage = 1;
    this.loadListings();
  }

  private searchTimer?: ReturnType<typeof setTimeout>;

  onSearchChange(): void {
    clearTimeout(this.searchTimer);

    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadListings();
    }, 300);
  }

  get totalPages(): number {
    return Math.ceil(this.totalListings / this.perPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadListings();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadListings();
    }
  }

  visibilityLabel(listing: Listing): string {
    return effectiveListingVisibility(listing);
  }
}
