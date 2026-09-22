import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';

import { SiteSettings, SiteSettingsUpdate } from '../models/site-settings';

@Injectable({ providedIn: 'root' })
export class SiteSettingsService {
  private readonly apiBaseUrl = 'http://localhost:8000';
  private readonly adminUrl = `${this.apiBaseUrl}/site-settings`;
  private readonly publicUrl = `${this.apiBaseUrl}/public/site-settings`;

  private publicSettingsRequest$: Observable<SiteSettings> | null = null;

  constructor(private readonly http: HttpClient) {}

  // Cache public settings so the shell and homepage share one request.
  getPublicSettings(): Observable<SiteSettings> {
    if (!this.publicSettingsRequest$) {
      this.publicSettingsRequest$ = this.http
        .get<SiteSettings>(this.publicUrl)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }

    return this.publicSettingsRequest$;
  }

  getAdminSettings(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(this.adminUrl);
  }

  updateAdminSettings(
    payload: SiteSettingsUpdate,
  ): Observable<SiteSettings> {
    return this.http.put<SiteSettings>(this.adminUrl, payload).pipe(
      tap(() => {
        // Force the public shell to fetch the newly saved configuration.
        this.publicSettingsRequest$ = null;
      }),
    );
  }
}
