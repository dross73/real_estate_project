import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ListingPhoto,
  ListingPhotoUploadSettings,
} from '../models/listing-photo';

@Injectable({
  providedIn: 'root',
})
export class ListingPhotoService {
  private readonly apiBaseUrl = 'http://localhost:8000';
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
