import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ListingDetailComponent } from './listing-detail.component';

describe('ListingDetailComponent', () => {
  let fixture: ComponentFixture<ListingDetailComponent>;
  let component: ListingDetailComponent;
  let httpController: HttpTestingController;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const listing = {
    id: 27,
    title: 'Warm Craftsman Near Downtown',
    status: 'Active' as const,
    is_featured: true,
    hide_exact_address: false,
    price: 425000,
    property_type: 'Single Family' as const,
    address: '123 Main St',
    city: 'Ames',
    state: 'IA',
    description: 'A welcoming home close to neighborhood amenities.',
    sqft: 1850,
    acreage: 0.24,
    year_built: 1928,
    bedrooms: 3,
    bathrooms: 2,
    annual_property_taxes: 5200,
    hoa_fee: null,
    hoa_fee_frequency: null,
    school_district: 'Ames',
    amenities: ['Hardwood floors', 'Fenced yard'],
    mls_number: 'JL-1027',
    source_attribution: null,
    cover_image: null,
    open_houses: [
      {
        id: 3,
        starts_at: '2026-10-03T18:00:00Z',
        ends_at: '2026-10-03T20:00:00Z',
      },
    ],
    created_at: null,
    updated_at: null,
  };

  beforeEach(async () => {
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: '27' }));

    await TestBed.configureTestingModule({
      imports: [ListingDetailComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            snapshot: { paramMap: convertToParamMap({ id: '27' }) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingDetailComponent);
    component = fixture.componentInstance;
    httpController = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should load the public listing for the route ID', () => {
    const detailRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );

    expect(detailRequest.request.method).toBe('GET');
    detailRequest.flush(listing);

    const similarRequest = httpController.expectOne(
      (request) =>
        request.url === 'http://localhost:8000/public/listings' &&
        request.params.get('location') === 'Ames' &&
        request.params.get('property_type') === 'Single Family',
    );
    similarRequest.flush({
      items: [],
      total: 0,
      page: 1,
      per_page: 4,
    });

    expect(component.listing).toEqual(listing);
    expect(component.listingLocation).toBe('123 Main St, Ames, IA');
    expect(component.isLoading).toBeFalse();
    expect(component.notFound).toBeFalse();
  });

  it('should expose upcoming open houses from the public listing response', () => {
    const detailRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );
    detailRequest.flush(listing);

    const similarRequest = httpController.expectOne(
      (request) => request.url === 'http://localhost:8000/public/listings',
    );
    similarRequest.flush({
      items: [],
      total: 0,
      page: 1,
      per_page: 4,
    });

    expect(component.upcomingOpenHouses.length).toBe(1);
    expect(component.upcomingOpenHouses[0].id).toBe(3);
  });

  it('should treat a 404 as an unavailable public listing', () => {
    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );

    request.flush('missing', { status: 404, statusText: 'Not Found' });

    expect(component.listing).toBeNull();
    expect(component.notFound).toBeTrue();
    expect(component.loadError).toBeFalse();
  });

  it('should distinguish server failures from not-found responses', () => {
    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );

    request.flush('error', { status: 500, statusText: 'Server Error' });

    expect(component.loadError).toBeTrue();
    expect(component.notFound).toBeFalse();
    expect(component.isLoading).toBeFalse();
  });

  it('should reject an invalid route ID before making a second API call', () => {
    const initialRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );
    initialRequest.flush('missing', { status: 404, statusText: 'Not Found' });

    paramMap$.next(convertToParamMap({ id: 'not-a-number' }));

    expect(component.listing).toBeNull();
    expect(component.notFound).toBeTrue();
    expect(component.isLoading).toBeFalse();

    httpController.expectNone(
      'http://localhost:8000/public/listings/not-a-number',
    );
  });

  it('should hide an exact address when the public API omits it', () => {
    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );

    request.flush({
      ...listing,
      hide_exact_address: true,
      address: null,
    });

    const similarRequest = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );
    similarRequest.flush({
      items: [],
      total: 0,
      page: 1,
      per_page: 4,
    });

    expect(component.listingLocation).toBe('Ames, IA');
  });
});
