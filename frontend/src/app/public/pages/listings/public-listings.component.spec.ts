import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ParamMap,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { SavedSearchService } from '../../services/saved-search.service';
import { PublicListingsComponent } from './public-listings.component';

describe('PublicListingsComponent', () => {
  let fixture: ComponentFixture<PublicListingsComponent>;
  let component: PublicListingsComponent;
  let httpController: HttpTestingController;
  let router: Router;
  let authService: jasmine.SpyObj<AuthService>;
  let savedSearchService: jasmine.SpyObj<SavedSearchService>;
  let routeParams: BehaviorSubject<ParamMap>;

  const queryParamMap = convertToParamMap({
    location: 'Ames',
    min_price: '250000',
    min_bedrooms: '3',
    sort: 'price_asc',
    page: '2',
  });

  const primaryPhoto = {
    id: 8,
    position: 0,
    is_primary: true,
    thumbnail_url: 'https://media.example/home-thumbnail.webp',
    medium_url: 'https://media.example/home-medium.webp',
    large_url: 'https://media.example/home-large.webp',
  };

  const listing = {
    id: 27,
    title: 'Warm Craftsman Near Downtown',
    status: 'Active' as const,
    is_featured: false,
    hide_exact_address: false,
    price: 425000,
    property_type: 'Single Family' as const,
    address: '123 Main St',
    city: 'Ames',
    state: 'IA',
    description: 'A welcoming home.',
    sqft: 1850,
    acreage: null,
    year_built: 1928,
    bedrooms: 3,
    bathrooms: 2,
    annual_property_taxes: null,
    hoa_fee: null,
    hoa_fee_frequency: null,
    school_district: null,
    amenities: [],
    mls_number: null,
    source_attribution: null,
    photos: [primaryPhoto],
    primary_photo: primaryPhoto,
    created_at: null,
    updated_at: null,
  };

  beforeEach(async () => {
    routeParams = new BehaviorSubject(queryParamMap);
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated',
      'getUserRole',
    ]);
    savedSearchService = jasmine.createSpyObj<SavedSearchService>(
      'SavedSearchService',
      ['create', 'update'],
    );

    authService.isAuthenticated.and.returnValue(false);
    authService.getUserRole.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [PublicListingsComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: routeParams.asObservable(),
            snapshot: { queryParamMap },
          },
        },
        { provide: AuthService, useValue: authService },
        { provide: SavedSearchService, useValue: savedSearchService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicListingsComponent);
    component = fixture.componentInstance;
    httpController = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    fixture.detectChanges();
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should load public listings from URL search parameters', () => {
    const request = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('location')).toBe('Ames');
    expect(request.request.params.get('min_price')).toBe('250000');
    expect(request.request.params.get('min_bedrooms')).toBe('3');
    expect(request.request.params.get('sort')).toBe('price_asc');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.has('status')).toBeFalse();
    expect(component.filterForm.getRawValue().status).toBe('');
    expect(fixture.nativeElement.querySelector('select[formcontrolname="status"] option[value=""]').textContent)
      .toBe('Active & Pending');

    request.flush({
      items: [],
      total: 0,
      page: 2,
      per_page: 12,
    });

    expect(component.isLoading).toBeFalse();
    expect(component.page).toBe(2);
  });

  it('should request and render explicit Sold results and preserve filters while sorting or paging', () => {
    httpController.expectOne(candidate => candidate.url === 'http://localhost:8000/public/listings')
      .flush({ items: [], total: 0, page: 2, per_page: 12 });
    routeParams.next(convertToParamMap({ location: 'Ames', status: 'Sold', sort: 'price_asc', page: '2' }));
    const request = httpController.expectOne(candidate => candidate.url === 'http://localhost:8000/public/listings');
    expect(request.request.params.get('status')).toBe('Sold');
    expect(request.request.params.get('location')).toBe('Ames');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ items: [{ ...listing, status: 'Sold' }], total: 40, page: 2, per_page: 12 });
    fixture.detectChanges();
    expect(component.filterForm.getRawValue().status).toBe('Sold');
    expect(fixture.nativeElement.querySelector('.listing-status').textContent).toContain('Sold');
    expect(component.total).toBe(40);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    component.applyFilters();
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ status: 'Sold', location: 'Ames' }),
    }));
    component.changeSort('price_desc');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { sort: 'price_desc', page: 1 }, queryParamsHandling: 'merge',
    }));
    component.goToPage(3);
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { page: 3 }, queryParamsHandling: 'merge',
    }));
    component.clearFilters();
    expect(navigate.calls.mostRecent().args[1]?.queryParams?.['status']).toBeUndefined();
  });

  it('should render the medium primary photo on a listing card', () => {
    const request = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );
    request.flush({
      items: [listing],
      total: 1,
      page: 2,
      per_page: 12,
    });
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
      'img.listing-card__image',
    ) as HTMLImageElement | null;

    expect(image).not.toBeNull();
    expect(image?.src).toContain('home-medium.webp');
  });

  it('should render the card placeholder when no primary photo exists', () => {
    const request = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );
    request.flush({
      items: [{ ...listing, photos: [], primary_photo: null }],
      total: 1,
      page: 2,
      per_page: 12,
    });
    fixture.detectChanges();

    const placeholder = fixture.nativeElement.querySelector(
      '.listing-card__image--placeholder',
    );

    expect(placeholder).not.toBeNull();
  });

  it('should write applied filters back to the URL', () => {
    const request = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );
    request.flush({
      items: [],
      total: 0,
      page: 2,
      per_page: 12,
    });

    spyOn(router, 'navigate').and.resolveTo(true);

    component.filterForm.patchValue({
      location: 'Story City',
      minPrice: '300000',
      maxPrice: '600000',
      minBedrooms: '4',
      status: 'Active',
    });

    component.applyFilters();

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        page: 1,
        location: 'Story City',
        min_price: 300000,
        max_price: 600000,
        min_bedrooms: 4,
        status: 'Active',
      }),
    });
  });

  it('should save the current supported filters for a verified public user', () => {
    const request = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );
    request.flush({
      items: [],
      total: 0,
      page: 2,
      per_page: 12,
    });

    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');
    savedSearchService.create.and.returnValue(
      of({
        id: 9,
        name: 'Ames homes',
        criteria: {
          location: 'Ames',
          min_price: 250000,
          min_bedrooms: 3,
        },
        alert_frequency: 'daily',
        alerts_enabled: true,
        last_alerted_at: null,
        created_at: '2026-09-21T00:00:00Z',
        updated_at: '2026-09-21T00:00:00Z',
      }),
    );
    spyOn(router, 'navigate').and.resolveTo(true);

    component.saveSearchName = 'Ames homes';
    component.saveSearchFrequency = 'daily';
    component.createSavedSearch();

    expect(savedSearchService.create).toHaveBeenCalledWith({
      name: 'Ames homes',
      criteria: jasmine.objectContaining({
        location: 'Ames',
        min_price: 250000,
        min_bedrooms: 3,
      }),
      alert_frequency: 'daily',
      alerts_enabled: true,
    });
    expect(component.activeSavedSearchId).toBe(9);
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { saved_search_id: 9 },
      queryParamsHandling: 'merge',
    });
  });

  it('should update an existing saved search with changed filters', () => {
    const request = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );
    request.flush({
      items: [],
      total: 0,
      page: 2,
      per_page: 12,
    });

    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');
    component.activeSavedSearchId = 12;
    savedSearchService.update.and.returnValue(
      of({
        id: 12,
        name: 'Existing search',
        criteria: { location: 'Ames' },
        alert_frequency: 'weekly',
        alerts_enabled: true,
        last_alerted_at: null,
        created_at: '2026-09-21T00:00:00Z',
        updated_at: '2026-09-21T00:00:00Z',
      }),
    );

    component.updateActiveSavedSearch();

    expect(savedSearchService.update).toHaveBeenCalledWith(
      12,
      jasmine.objectContaining({
        criteria: jasmine.objectContaining({
          location: 'Ames',
          min_price: 250000,
          min_bedrooms: 3,
        }),
      }),
    );
    expect(component.saveSearchMessage).toContain('updated');
  });

  it('should reject contradictory ranges before navigating', () => {
    const request = httpController.expectOne(
      (candidate) => candidate.url === 'http://localhost:8000/public/listings',
    );
    request.flush({
      items: [],
      total: 0,
      page: 2,
      per_page: 12,
    });

    spyOn(router, 'navigate').and.resolveTo(true);

    component.filterForm.patchValue({
      minPrice: '700000',
      maxPrice: '500000',
    });

    component.applyFilters();

    expect(component.filterValidationMessage).toContain('Minimum price');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
