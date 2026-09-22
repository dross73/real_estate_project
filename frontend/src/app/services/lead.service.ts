import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AssignmentOptions,
  Lead,
  LeadList,
  LeadStatus,
  LeadType,
  LeadUpdate,
} from '../models/lead';

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly apiUrl = 'http://localhost:8000/leads';

  constructor(private readonly http: HttpClient) {}

  getLeads(filters: {
    status?: LeadStatus;
    inquiry_type?: LeadType;
    q?: string;
  } = {}): Observable<LeadList> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });

    return this.http.get<LeadList>(this.apiUrl, { params });
  }

  getLead(id: number): Observable<Lead> {
    return this.http.get<Lead>(`${this.apiUrl}/${id}`);
  }

  updateLead(id: number, payload: LeadUpdate): Observable<Lead> {
    return this.http.put<Lead>(`${this.apiUrl}/${id}`, payload);
  }

  addNote(id: number, note: string): Observable<Lead> {
    return this.http.post<Lead>(`${this.apiUrl}/${id}/notes`, { note });
  }

  getAssignmentOptions(): Observable<AssignmentOptions> {
    return this.http.get<AssignmentOptions>(
      `${this.apiUrl}/assignment-options`,
    );
  }
}
