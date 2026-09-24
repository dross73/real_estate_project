import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../core/api-base-url';

import {
  PublicTestimonial,
  PublicTestimonialCreate,
  Testimonial,
  TestimonialCreate,
  TestimonialSource,
  TestimonialStatus,
  TestimonialUpdate,
} from '../models/testimonial';

@Injectable({ providedIn: 'root' })
export class TestimonialService {
  private readonly apiBaseUrl = apiUrl();
  private readonly adminUrl = `${this.apiBaseUrl}/testimonials`;
  private readonly publicUrl = `${this.apiBaseUrl}/public/testimonials`;

  constructor(private readonly http: HttpClient) {}

  getTestimonials(filters: {
    status?: TestimonialStatus;
    source?: TestimonialSource;
  } = {}): Observable<Testimonial[]> {
    let params = new HttpParams();

    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.source) {
      params = params.set('source', filters.source);
    }

    return this.http.get<Testimonial[]>(this.adminUrl, { params });
  }

  getTestimonial(id: number): Observable<Testimonial> {
    return this.http.get<Testimonial>(`${this.adminUrl}/${id}`);
  }

  createTestimonial(payload: TestimonialCreate): Observable<Testimonial> {
    return this.http.post<Testimonial>(this.adminUrl, payload);
  }

  updateTestimonial(
    id: number,
    payload: TestimonialUpdate,
  ): Observable<Testimonial> {
    return this.http.put<Testimonial>(`${this.adminUrl}/${id}`, payload);
  }

  deleteTestimonial(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }

  getPublicTestimonials(limit = 6): Observable<PublicTestimonial[]> {
    return this.http.get<PublicTestimonial[]>(this.publicUrl, {
      params: { limit },
    });
  }

  submitPublicTestimonial(
    payload: PublicTestimonialCreate,
  ): Observable<PublicTestimonial> {
    return this.http.post<PublicTestimonial>(this.publicUrl, payload);
  }
}
