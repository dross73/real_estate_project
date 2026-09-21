import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ListingService } from './listing.service';

describe('ListingService preview', () => {
  let service: ListingService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(ListingService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should request the protected public-facing preview endpoint', () => {
    service.getListingPreview(27).subscribe((listing) => {
      expect(listing.id).toBe(27);
      expect(listing.status).toBe('Draft');
    });

    const request = httpController.expectOne(
      'http://localhost:8000/listings/27/preview',
    );

    expect(request.request.method).toBe('GET');
    request.flush({
      id: 27,
      title: 'Preview Home',
      status: 'Draft',
      is_featured: false,
      hide_exact_address: false,
      price: 350000,
      property_type: 'Single Family',
      address: '123 Preview St',
      city: 'Ames',
      state: 'IA',
      description: null,
      sqft: 1800,
      acreage: null,
      year_built: 2000,
      bedrooms: 3,
      bathrooms: 2,
      annual_property_taxes: null,
      hoa_fee: null,
      hoa_fee_frequency: null,
      school_district: null,
      amenities: [],
      mls_number: null,
      source_attribution: null,
      cover_image: null,
      created_at: null,
      updated_at: null,
    });
  });
});
