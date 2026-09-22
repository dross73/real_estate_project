import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PublicInquiryService } from './public-inquiry.service';

describe('PublicInquiryService', () => {
  let service: PublicInquiryService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(PublicInquiryService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should list the current public users requests', () => {
    service.list().subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/public/account/inquiries',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0 });
  });

  it('should submit an idempotent showing request payload', () => {
    service
      .submit({
        inquiry_type: 'showing',
        listing_id: 27,
        message: 'Saturday afternoon.',
        preferred_at: '2026-09-26T15:00:00.000Z',
        submission_key: 'request-key-00000001',
      })
      .subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/public/account/inquiries',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body.submission_key).toBe(
      'request-key-00000001',
    );
    request.flush({
      id: 10,
      inquiry_type: 'showing',
      status: 'New',
      listing_id: 27,
      listing_title: 'Warm Craftsman Near Downtown',
      message: 'Saturday afternoon.',
      preferred_at: '2026-09-26T15:00:00.000Z',
      destination_label: 'Jane Morgan',
      created_at: '2026-09-22T00:00:00Z',
    });
  });
});
