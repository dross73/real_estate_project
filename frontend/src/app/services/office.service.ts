import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Office,
  OfficeCreate,
  OfficeUpdate,
  PublicOfficeSummary,
} from '../models/office';

@Injectable({ providedIn: 'root' })
export class OfficeService {
  private readonly apiBaseUrl = 'http://localhost:8000';
  private readonly adminUrl = `${this.apiBaseUrl}/offices`;
  private readonly publicUrl = `${this.apiBaseUrl}/public/offices`;

  constructor(private readonly http: HttpClient) {}

  getOffices(activeOnly = false): Observable<Office[]> {
    return this.http.get<Office[]>(this.adminUrl, {
      params: { active_only: activeOnly },
    });
  }

  getOffice(id: number): Observable<Office> {
    return this.http.get<Office>(`${this.adminUrl}/${id}`);
  }

  createOffice(payload: OfficeCreate): Observable<Office> {
    return this.http.post<Office>(this.adminUrl, payload);
  }

  updateOffice(id: number, payload: OfficeUpdate): Observable<Office> {
    return this.http.put<Office>(`${this.adminUrl}/${id}`, payload);
  }

  deleteOffice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }

  getPublicOffice(id: number): Observable<PublicOfficeSummary> {
    return this.http.get<PublicOfficeSummary>(`${this.publicUrl}/${id}`);
  }
}
