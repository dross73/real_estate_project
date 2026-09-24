// Service responsible for communicating with the FastAPI listings endpoint.
// Keeping API calls here prevents the component from handling backend request details.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { apiUrl } from '../core/api-base-url';

import {
  Listing,
  ListingCreate,
  ListingUpdate,
  OpenHouseCreate,
  OpenHouseEvent,
  OpenHouseUpdate,
  PaginatedListingsResponse,
} from '../models/listing';
import { ListingPreview } from '../public/models/public-listing';
import {
  ListingDocument,
  ListingDocumentUpdate,
} from '../models/listing-document';

@Injectable({
  providedIn: 'root',
})
export class ListingService {
  // Shared base URL for the configured FastAPI backend
  private readonly apiBaseUrl = apiUrl();

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

  // Fetches the public-facing preview for staff/admin, even before publication.
  getListingPreview(id: number): Observable<ListingPreview> {
    return this.http.get<ListingPreview>(`${this.apiUrl}/${id}/preview`);
  }

  // Creates a new listing through the backend
  createListing(listing: ListingCreate): Observable<Listing> {
    return this.http.post<Listing>(this.apiUrl, listing);
  }

  // Updates an existing listing through the backend
  updateListing(id: number, listing: ListingUpdate): Observable<Listing> {
    return this.http.put<Listing>(`${this.apiUrl}/${id}`, listing);
  }

  // Lists every scheduled open house for one listing, including past events.
  getOpenHouses(listingId: number): Observable<OpenHouseEvent[]> {
    return this.http.get<OpenHouseEvent[]>(
      `${this.apiUrl}/${listingId}/open-houses`,
    );
  }

  // Adds one future open-house event to a listing.
  createOpenHouse(
    listingId: number,
    payload: OpenHouseCreate,
  ): Observable<OpenHouseEvent> {
    return this.http.post<OpenHouseEvent>(
      `${this.apiUrl}/${listingId}/open-houses`,
      payload,
    );
  }

  // Updates the date/time window for an existing open-house event.
  updateOpenHouse(
    listingId: number,
    eventId: number,
    payload: OpenHouseUpdate,
  ): Observable<OpenHouseEvent> {
    return this.http.put<OpenHouseEvent>(
      `${this.apiUrl}/${listingId}/open-houses/${eventId}`,
      payload,
    );
  }

  // Removes one open-house event from a listing.
  deleteOpenHouse(listingId: number, eventId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${listingId}/open-houses/${eventId}`,
    );
  }

  // Lists all documents attached to a listing for staff/admin management.
  getDocuments(listingId: number): Observable<ListingDocument[]> {
    return this.http.get<ListingDocument[]>(
      `${this.apiUrl}/${listingId}/documents`,
    );
  }

  // Uploads one PDF document after the listing itself exists.
  uploadDocument(
    listingId: number,
    title: string,
    isPublic: boolean,
    file: File,
  ): Observable<ListingDocument> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('is_public', String(isPublic));
    formData.append('file', file);

    return this.http.post<ListingDocument>(
      `${this.apiUrl}/${listingId}/documents`,
      formData,
    );
  }

  // Updates document metadata without replacing the stored PDF.
  updateDocument(
    listingId: number,
    documentId: number,
    payload: ListingDocumentUpdate,
  ): Observable<ListingDocument> {
    return this.http.patch<ListingDocument>(
      `${this.apiUrl}/${listingId}/documents/${documentId}`,
      payload,
    );
  }

  // Removes one listing document and its stored object.
  deleteDocument(listingId: number, documentId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${listingId}/documents/${documentId}`,
    );
  }

  // Deletes one listing by ID from the backend.
  deleteListing(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/listings/${id}`);
  }
}
