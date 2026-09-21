import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { PublicListing } from '../models/public-listing';

@Injectable({
  providedIn: 'root',
})
export class PublicListingService {
  private readonly apiBaseUrl = 'http://localhost:8000';
  private readonly publicListingsUrl = `${this.apiBaseUrl}/public/listings`;

  constructor(private readonly http: HttpClient) {}

  // Homepage-specific query for listings explicitly marked as featured.
  getFeaturedListings(limit = 4): Observable<PublicListing[]> {
    return this.http.get<PublicListing[]>(
      `${this.publicListingsUrl}/featured`,
      {
        params: { limit },
      },
    );
  }
}
