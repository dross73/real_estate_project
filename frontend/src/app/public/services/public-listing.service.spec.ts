import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PublicListingService } from './public-listing.service';

describe('PublicListingService documents', () => {
  let service: PublicListingService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(PublicListingService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should load public listing documents', () => {
    service.getDocuments(27).subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/27/documents',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
