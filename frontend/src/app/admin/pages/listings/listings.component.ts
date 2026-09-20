import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
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

  get filteredListings(): Listing[] {
    const term = this.searchTerm.toLowerCase().trim();

    return this.listings.filter((listing) => {
      const matchesSearch =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term) ||
        listing.city.toLowerCase().includes(term) ||
        listing.status.toLowerCase().includes(term) ||
        listing.mls_number?.toLowerCase().includes(term);

      const matchesStatus =
        this.statusFilter === 'All' || listing.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }
}
