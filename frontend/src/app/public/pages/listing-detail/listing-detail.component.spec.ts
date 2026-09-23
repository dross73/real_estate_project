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
import { BehaviorSubject, of } from 'rxjs';

import { AnalyticsService } from '../../../services/analytics.service';
import { PrivacyConsentService } from '../../../services/privacy-consent.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { ListingDetailComponent } from './listing-detail.component';

describe('ListingDetailComponent', () => {
  let fixture: ComponentFixture<ListingDetailComponent>;
  let component: ListingDetailComponent;
  let httpController: HttpTestingController;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let analyticsService: jasmine.SpyObj<AnalyticsService>;
  let siteSettingsService: jasmine.SpyObj<SiteSettingsService>;
  let privacyConsentService: jasmine.SpyObj<PrivacyConsentService>;

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
    virtual_tour_url: 'https://my.matterport.com/show/?m=abc',
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

    analyticsService = jasmine.createSpyObj<AnalyticsService>(
      'AnalyticsService',
      ['recordListingView'],
    );
    analyticsService.recordListingView.and.returnValue(of(void 0));

    siteSettingsService = jasmine.createSpyObj<SiteSettingsService>(
      'SiteSettingsService',
      ['getPublicSettings'],
    );
    siteSettingsService.getPublicSettings.and.returnValue(
      of({
        privacy_consent_enabled: false,
        privacy_analytics_category_enabled: false,
      } as any),
    );

    privacyConsentService = jasmine.createSpyObj<PrivacyConsentService>(
      'PrivacyConsentService',
      ['allowsAnalytics'],
    );
    privacyConsentService.allowsAnalytics.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [ListingDetailComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: SiteSettingsService, useValue: siteSettingsService },
        { provide: PrivacyConsentService, useValue: privacyConsentService },
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

  function flushDocuments(documents: unknown[] = []): void {
    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/27/documents',
    );
    expect(request.request.method).toBe('GET');
    request.flush(documents);
  }

  it('should load the public listing for the route ID', () => {
    const detailRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );

    expect(detailRequest.request.method).toBe('GET');
    detailRequest.flush(listing);
    flushDocuments();

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
    expect(analyticsService.recordListingView).toHaveBeenCalledWith(27);
  });

  it('should skip view analytics when configured consent has not been granted', () => {
    siteSettingsService.getPublicSettings.and.returnValue(
      of({
        privacy_consent_enabled: true,
        privacy_analytics_category_enabled: true,
      } as any),
    );
    privacyConsentService.allowsAnalytics.and.returnValue(false);

    const detailRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );
    detailRequest.flush(listing);
    flushDocuments();

    const similarRequest = httpController.expectOne(
      (request) => request.url === 'http://localhost:8000/public/listings',
    );
    similarRequest.flush({
      items: [],
      total: 0,
      page: 1,
      per_page: 4,
    });

    expect(analyticsService.recordListingView).not.toHaveBeenCalled();
  });

  it('should expose upcoming open houses from the public listing response', () => {
    const detailRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );
    detailRequest.flush(listing);
    flushDocuments();

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

  it('should load public PDF resources without blocking the listing', () => {
    const detailRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );
    detailRequest.flush(listing);

    flushDocuments([
      {
        id: 7,
        title: 'Feature Sheet',
        original_filename: 'feature-sheet.pdf',
        content_type: 'application/pdf',
        file_size: 2048,
        download_url: 'https://media.example/feature-sheet.pdf',
      },
    ]);

    const similarRequest = httpController.expectOne(
      (request) => request.url === 'http://localhost:8000/public/listings',
    );
    similarRequest.flush({
      items: [],
      total: 0,
      page: 1,
      per_page: 4,
    });

    expect(component.documents.length).toBe(1);
    expect(component.virtualTourLabel).toBe('Open Matterport Tour');
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
    flushDocuments();

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
    expect(decodeURIComponent(component.mapSearchUrl)).toContain('Ames, IA');
    expect(component.mapSearchUrl).not.toContain('123%20Main');
  });
});
