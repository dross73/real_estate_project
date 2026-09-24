import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../../core/api-base-url';

import {
  SavedSearch,
  SavedSearchCreate,
  SavedSearchList,
  SavedSearchUpdate,
} from '../models/saved-search';

@Injectable({
  providedIn: 'root',
})
export class SavedSearchService {
  private readonly apiUrl = apiUrl('/public/account/saved-searches');

  constructor(private readonly http: HttpClient) {}

  list(): Observable<SavedSearchList> {
    return this.http.get<SavedSearchList>(this.apiUrl);
  }

  create(payload: SavedSearchCreate): Observable<SavedSearch> {
    return this.http.post<SavedSearch>(this.apiUrl, payload);
  }

  update(
    searchId: number,
    payload: SavedSearchUpdate,
  ): Observable<SavedSearch> {
    return this.http.put<SavedSearch>(
      `${this.apiUrl}/${searchId}`,
      payload,
    );
  }

  delete(searchId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${searchId}`);
  }
}
