import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../core/api-base-url';

import {
  ListingPhoto,
  ListingPhotoUploadSettings,
} from '../models/listing-photo';

@Injectable({
  providedIn: 'root',
})
export class ListingPhotoService {
  private readonly apiBaseUrl = apiUrl();
  private readonly listingsUrl = `${this.apiBaseUrl}/listings`;

  constructor(private readonly http: HttpClient) {}

  // Read the effective backend photo limits so the UI shows accurate usage.
  getUploadSettings(): Observable<ListingPhotoUploadSettings> {
    return this.http.get<ListingPhotoUploadSettings>(
      `${this.listingsUrl}/photo-upload-settings`,
    );
  }

  // Load the current optimized gallery for one listing.
  getPhotos(listingId: number): Observable<ListingPhoto[]> {
    return this.http.get<ListingPhoto[]>(
      `${this.listingsUrl}/${listingId}/photos`,
    );
  }

  // Persist the complete gallery order.
  reorderPhotos(listingId: number, photoIds: number[]): Observable<ListingPhoto[]> {
    return this.http.put<ListingPhoto[]>(
      `${this.listingsUrl}/${listingId}/photos/order`,
      { photo_ids: photoIds },
    );
  }

  // Select one primary photo independently from gallery order.
  setPrimaryPhoto(listingId: number, photoId: number): Observable<ListingPhoto> {
    return this.http.patch<ListingPhoto>(
      `${this.listingsUrl}/${listingId}/photos/${photoId}/primary`,
      {},
    );
  }

  // Delete one stored listing photo.
  deletePhoto(listingId: number, photoId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.listingsUrl}/${listingId}/photos/${photoId}`,
    );
  }

  // Replace a stored photo in place while the backend preserves order/primary state.
  replacePhoto(
    listingId: number,
    photoId: number,
    file: File,
  ): Observable<ListingPhoto> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.put<ListingPhoto>(
      `${this.listingsUrl}/${listingId}/photos/${photoId}/replace`,
      formData,
    );
  }

  // Upload one source file at a time and expose progress events to the queue UI.
  uploadPhoto(
    listingId: number,
    file: File,
  ): Observable<HttpEvent<ListingPhoto>> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<ListingPhoto>(
      `${this.listingsUrl}/${listingId}/photos`,
      formData,
      {
        observe: 'events',
        reportProgress: true,
      },
    );
  }
}
