
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, DOCUMENT } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../core/api-base-url';

import { AnalyticsOverview } from '../models/analytics';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  private readonly apiBaseUrl = apiUrl();
  private readonly adminUrl = `${this.apiBaseUrl}/analytics`;
  private readonly publicUrl = `${this.apiBaseUrl}/public/analytics`;

  getOverview(days: number): Observable<AnalyticsOverview> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<AnalyticsOverview>(
      `${this.adminUrl}/overview`,
      { params },
    );
  }

  // Send only a hostname, never a full referring URL or visitor identity.
  recordListingView(listingId: number): Observable<void> {
    return this.http.post<void>(
      `${this.publicUrl}/listing-views/${listingId}`,
      { referrer_host: this.externalReferrerHost() },
    );
  }

  private externalReferrerHost(): string | null {
    const referrer = this.document.referrer;
    if (!referrer) {
      return null;
    }

    try {
      const referrerUrl = new URL(referrer);
      const currentHost = this.document.location?.hostname?.toLowerCase() ?? '';
      const referrerHost = referrerUrl.hostname.toLowerCase();

      return referrerHost && referrerHost !== currentHost
        ? referrerHost
        : null;
    } catch {
      return null;
    }
  }
}
