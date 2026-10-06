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
import { AuthService } from '../../../services/auth.service';
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

  const secondaryPhoto = {
    id: 11,
    position: 0,
    is_primary: false,
    thumbnail_url: 'https://media.example/11-thumbnail.webp',
    medium_url: 'https://media.example/11-medium.webp',
    large_url: 'https://media.example/11-large.webp',
  };

  const primaryPhoto = {
    id: 12,
    position: 4,
    is_primary: true,
    thumbnail_url: 'https://media.example/12-thumbnail.webp',
    medium_url: 'https://media.example/12-medium.webp',
    large_url: 'https://media.example/12-large.webp',
  };

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
    photos: [secondaryPhoto, primaryPhoto],
    primary_photo: primaryPhoto,
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

  it('should select the primary photo and show it first in the thumbnail order', () => {
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

    expect(component.selectedPhoto).toEqual(primaryPhoto);
    expect(component.orderedPhotos.map((photo) => photo.id)).toEqual([12, 11]);

    component.selectPhoto(secondaryPhoto);
    expect(component.selectedPhoto).toEqual(secondaryPhoto);
  });

  it('should render the property-photo fallback when no photos exist', () => {
    const detailRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/27',
    );
    detailRequest.flush({
      ...listing,
      photos: [],
      primary_photo: null,
    });
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
    fixture.detectChanges();

    expect(component.selectedPhoto).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.media-placeholder--primary'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.media-gallery__thumbnail-button')
        .length,
    ).toBe(0);
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

  for (const status of ['Active', 'Pending', 'Sold'] as const) {
    it(`should keep the appropriate price, actions, and property information for ${status}`, () => {
      httpController.expectOne('http://localhost:8000/public/listings/27')
        .flush({ ...listing, status, source_attribution: 'Example MLS' });
      flushDocuments();
      const similar = httpController.expectOne(candidate => candidate.url === 'http://localhost:8000/public/listings');
      expect(similar.request.params.get('location')).toBe('Ames');
      expect(similar.request.params.has('status')).toBeFalse();
      similar.flush({ items: [{ ...listing, id: 28 }], total: 1, page: 1, per_page: 4 });
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('.property-header__price')?.textContent?.trim())
        .toBe(status === 'Sold' ? 'Last listed at $425,000' : '$425,000');
      expect(host.querySelector('.listing-share')).not.toBeNull();
      expect(host.querySelector('.media-gallery__thumbnail-button')).not.toBeNull();
      expect(host.querySelector('.source-attribution')?.textContent).toContain('Example MLS');
      expect(host.querySelector('#similar-title')?.textContent).toBe('Similar Homes Nearby');
      expect(host.textContent).toContain('Hardwood floors');
      expect(host.querySelector('.save-home__signin')).not.toBeNull();
      const showing = host.querySelector('a[href*="intent=showing"]');
      if (status === 'Sold') {
        expect(showing).toBeNull();
        expect(host.querySelector('.mortgage-tool')).toBeNull();
        expect(host.querySelector('.open-house-section')).toBeNull();
        expect(component.upcomingOpenHouses).toEqual([]);
        expect(host.querySelector('.contact-card h2')?.textContent).toBe('Interested in a home like this?');
        expect(host.textContent).toContain('not the closing price');
        const primary = host.querySelector('.contact-card__actions .button--primary') as HTMLAnchorElement;
        expect(primary.textContent).toBe('View Similar Homes');
        const url = new URL(primary.href);
        expect(url.pathname).toBe('/listings');
        expect(url.searchParams.get('location')).toBe('Ames');
        expect(url.searchParams.get('property_type')).toBe('Single Family');
        expect(url.searchParams.has('status')).toBeFalse();
        const contact = host.querySelector('.contact-card__actions .button--secondary') as HTMLAnchorElement;
        expect(contact.textContent).toBe('Contact Juniper & Lane');
        expect(new URL(contact.href).searchParams.get('intent')).toBe('question');
      } else {
        expect(showing?.textContent?.trim()).toBe('Schedule Showing');
        expect(host.querySelector('.mortgage-tool')).not.toBeNull();
        expect(host.querySelector('.open-house-section')).not.toBeNull();
        expect(host.querySelector('.contact-card h2')?.textContent).toBe('See this home in person.');
      }
    });
  }

  it('should keep saving a Sold home available to a signed-in public user', () => {
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    spyOn(auth, 'getUserRole').and.returnValue('public_user');
    httpController.expectOne('http://localhost:8000/public/listings/27')
      .flush({ ...listing, status: 'Sold' });
    flushDocuments();
    httpController.expectOne(candidate => candidate.url === 'http://localhost:8000/public/listings')
      .flush({ items: [], total: 0, page: 1, per_page: 4 });
    httpController.expectOne('http://localhost:8000/public/account/favorites/27')
      .flush({ listing_id: 27, is_favorite: false });
    httpController.expectOne('http://localhost:8000/public/account/recently-viewed/27').flush(null);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.save-home__button').click();
    const save = httpController.expectOne('http://localhost:8000/public/account/favorites/27');
    expect(save.request.method).toBe('PUT');
    save.flush({ listing_id: 27, is_favorite: true });
    fixture.detectChanges();
    expect(component.isFavorite).toBeTrue();
    expect(fixture.nativeElement.querySelector('.save-home__button').getAttribute('aria-pressed')).toBe('true');
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
    component.mapVisible = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-listing-map').textContent).toContain('withheld for privacy');
  });
});
