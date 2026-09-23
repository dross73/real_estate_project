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

  it('should manage listing open houses through nested endpoints', () => {
    service.getOpenHouses(27).subscribe();

    const list = httpController.expectOne(
      'http://localhost:8000/listings/27/open-houses',
    );
    expect(list.request.method).toBe('GET');
    list.flush([]);

    service
      .createOpenHouse(27, {
        starts_at: '2026-10-01T18:00:00.000Z',
        ends_at: '2026-10-01T20:00:00.000Z',
      })
      .subscribe();

    const create = httpController.expectOne(
      'http://localhost:8000/listings/27/open-houses',
    );
    expect(create.request.method).toBe('POST');
    create.flush({
      id: 4,
      listing_id: 27,
      starts_at: '2026-10-01T18:00:00.000Z',
      ends_at: '2026-10-01T20:00:00.000Z',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    });

    service
      .updateOpenHouse(27, 4, {
        ends_at: '2026-10-01T21:00:00.000Z',
      })
      .subscribe();

    const update = httpController.expectOne(
      'http://localhost:8000/listings/27/open-houses/4',
    );
    expect(update.request.method).toBe('PUT');
    update.flush({
      id: 4,
      listing_id: 27,
      starts_at: '2026-10-01T18:00:00.000Z',
      ends_at: '2026-10-01T21:00:00.000Z',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T01:00:00Z',
    });

    service.deleteOpenHouse(27, 4).subscribe();

    const remove = httpController.expectOne(
      'http://localhost:8000/listings/27/open-houses/4',
    );
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('should manage listing documents through nested endpoints', () => {
    service.getDocuments(27).subscribe();

    const list = httpController.expectOne(
      'http://localhost:8000/listings/27/documents',
    );
    expect(list.request.method).toBe('GET');
    list.flush([]);

    const file = new File(['%PDF-1.4'], 'feature-sheet.pdf', {
      type: 'application/pdf',
    });
    service.uploadDocument(27, 'Feature Sheet', true, file).subscribe();

    const upload = httpController.expectOne(
      'http://localhost:8000/listings/27/documents',
    );
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body instanceof FormData).toBeTrue();
    upload.flush({
      id: 8,
      listing_id: 27,
      title: 'Feature Sheet',
      original_filename: 'feature-sheet.pdf',
      content_type: 'application/pdf',
      file_size: 2048,
      is_public: true,
      download_url: 'https://media.example/feature-sheet.pdf',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    });

    service.updateDocument(27, 8, { is_public: false }).subscribe();
    const update = httpController.expectOne(
      'http://localhost:8000/listings/27/documents/8',
    );
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ is_public: false });
    update.flush({});

    service.deleteDocument(27, 8).subscribe();
    const remove = httpController.expectOne(
      'http://localhost:8000/listings/27/documents/8',
    );
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
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
