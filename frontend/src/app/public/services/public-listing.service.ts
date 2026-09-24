import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../../core/api-base-url';

import { PublicListingDocument } from '../../models/listing-document';
import {
  PaginatedPublicListings,
  PublicListing,
  PublicListingSearchParams,
} from '../models/public-listing';

@Injectable({
  providedIn: 'root',
})
export class PublicListingService {
  private readonly apiBaseUrl = apiUrl();
  private readonly publicListingsUrl = `${this.apiBaseUrl}/public/listings`;

  constructor(private readonly http: HttpClient) {}

  // Search anonymous/public listings using the backend's supported query filters.
  searchListings(
    search: PublicListingSearchParams = {},
  ): Observable<PaginatedPublicListings> {
    let params = new HttpParams();

    Object.entries(search).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<PaginatedPublicListings>(this.publicListingsUrl, {
      params,
    });
  }

  // Homepage-specific query for listings explicitly marked as featured.
  getFeaturedListings(limit = 4): Observable<PublicListing[]> {
    return this.http.get<PublicListing[]>(
      `${this.publicListingsUrl}/featured`,
      {
        params: { limit },
      },
    );
  }

  // Load one public-safe listing by ID for the public detail page.
  getListingById(id: number): Observable<PublicListing> {
    return this.http.get<PublicListing>(
      `${this.publicListingsUrl}/${id}`
    );
  }

  // Load only documents explicitly published for an eligible public listing.
  getDocuments(id: number): Observable<PublicListingDocument[]> {
    return this.http.get<PublicListingDocument[]>(
      `${this.publicListingsUrl}/${id}/documents`,
    );
  }
}
