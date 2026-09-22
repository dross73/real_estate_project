import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  PublicInquiry,
  PublicInquiryCreate,
  PublicInquiryList,
} from '../models/public-inquiry';

@Injectable({ providedIn: 'root' })
export class PublicInquiryService {
  private readonly apiUrl =
    'http://localhost:8000/public/account/inquiries';

  constructor(private readonly http: HttpClient) {}

  list(): Observable<PublicInquiryList> {
    return this.http.get<PublicInquiryList>(this.apiUrl);
  }

  submit(payload: PublicInquiryCreate): Observable<PublicInquiry> {
    return this.http.post<PublicInquiry>(this.apiUrl, payload);
  }
}
