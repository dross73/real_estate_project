import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { LeadStatus, LeadType } from '../models/lead';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly apiUrl = 'http://localhost:8000/exports';

  exportLeads(filters: {
    status?: LeadStatus;
    inquiry_type?: LeadType;
    q?: string;
  } = {}): Observable<Blob> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get(`${this.apiUrl}/leads.csv`, {
      params,
      responseType: 'blob',
    });
  }

  exportAnalytics(days: number): Observable<Blob> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get(`${this.apiUrl}/analytics.csv`, {
      params,
      responseType: 'blob',
    });
  }

  saveCsv(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.click();
    URL.revokeObjectURL(url);
  }
}
