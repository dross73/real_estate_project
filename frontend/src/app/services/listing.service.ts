// Service responsible for communicating with the FastAPI listings endpoint.
// Keeping API calls here prevents the component from handling backend request details.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Listing,
  ListingCreate,
  ListingUpdate,
  PaginatedListingsResponse,
} from '../models/listing';

@Injectable({
  providedIn: 'root',
})
export class ListingService {
  // Shared base URL for the local FastAPI backend
  private readonly apiBaseUrl = 'http://localhost:8000';

  // Full listings endpoint built from the base API URL
  private readonly apiUrl = `${this.apiBaseUrl}/listings`;

  constructor(private http: HttpClient) {}

  // Fetches one page of listings from the backend
  getListings(
    page: number,
    perPage: number,
  ): Observable<PaginatedListingsResponse> {
    return this.http.get<PaginatedListingsResponse>(this.apiUrl, {
      params: {
        page,
        per_page: perPage,
      },
    });
  }

  // Fetches one listing from the backend by its ID
  getListingById(id: number): Observable<Listing> {
    return this.http.get<Listing>(`${this.apiUrl}/${id}`);
  }

  // Creates a new listing through the backend
  createListing(listing: ListingCreate): Observable<Listing> {
    return this.http.post<Listing>(this.apiUrl, listing);
  }

  // Updates an existing listing through the backend
  updateListing(id: number, listing: ListingUpdate): Observable<Listing> {
    return this.http.put<Listing>(`${this.apiUrl}/${id}`, listing);
  }
}
