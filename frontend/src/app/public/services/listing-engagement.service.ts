import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../../core/api-base-url';

import {
  FavoriteState,
  ListingCollection,
} from '../models/listing-engagement';

@Injectable({
  providedIn: 'root',
})
export class ListingEngagementService {
  private readonly apiUrl = apiUrl('/public/account');

  constructor(private readonly http: HttpClient) {}

  getFavorites(): Observable<ListingCollection> {
    return this.http.get<ListingCollection>(`${this.apiUrl}/favorites`);
  }

  getFavoriteState(listingId: number): Observable<FavoriteState> {
    return this.http.get<FavoriteState>(
      `${this.apiUrl}/favorites/${listingId}`,
    );
  }

  addFavorite(listingId: number): Observable<FavoriteState> {
    return this.http.put<FavoriteState>(
      `${this.apiUrl}/favorites/${listingId}`,
      {},
    );
  }

  removeFavorite(listingId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/favorites/${listingId}`,
    );
  }

  recordRecentlyViewed(listingId: number): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/recently-viewed/${listingId}`,
      {},
    );
  }

  getRecentlyViewed(limit = 12): Observable<ListingCollection> {
    return this.http.get<ListingCollection>(
      `${this.apiUrl}/recently-viewed`,
      { params: { limit } },
    );
  }
}
