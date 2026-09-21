import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicListingService } from '../../services/public-listing.service';
import { PublicListing } from '../../models/public-listing';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-listing-detail',
  imports: [],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.css',
})
export class ListingDetailComponent implements OnInit {
  listing: PublicListing | null = null;
  isLoading = true;
  notFound = false;
  loadError = false;
  constructor(
    private readonly route: ActivatedRoute,
    private readonly publicListingService: PublicListingService,
  ) {}
  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));

      if (!Number.isInteger(id) || id <= 0) {
        this.isLoading = false;
        this.notFound = true;
        return;
      }

      this.loadListing(id);
    });
  }

  // Load the public-safe listing that matches the route ID.
  private loadListing(id: number): void {
    this.isLoading = true;
    this.notFound = false;
    this.loadError = false;

    this.publicListingService.getListingById(id).subscribe({
      next: (listing) => {
        this.listing = listing;
        this.isLoading = false;
      },

      error: (error: HttpErrorResponse) => {
        this.isLoading = false;

        if (error.status === 404) {
          this.notFound = true;
        } else {
          this.loadError = true;
        }
      },
    });
  }
}
