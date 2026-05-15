// Service responsible for communicating with the FastAPI listings endpoint.
// Keeping API calls here prevents the component from handling backend request details.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { PaginatedListingsResponse } from '../models/listing';

@Injectable({
  providedIn: 'root',
})
export class ListingService {
  
  // Shared base URL for the local FastAPI backend
  private readonly apiBaseUrl = 'http://localhost:8000';

  // Full listings endpoint built from the base API URL
  private readonly apiUrl = `${this.apiBaseUrl}/listings`;

  constructor(private http: HttpClient) {}

  // Fetches paginated listings from the backend
  getListings(): Observable<PaginatedListingsResponse> {
    return this.http.get<PaginatedListingsResponse>(this.apiUrl);
  }
}
