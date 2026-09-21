import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of } from 'rxjs';

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

  const queryParamMap = convertToParamMap({
    location: 'Ames',
    min_price: '250000',
    min_bedrooms: '3',
    sort: 'price_asc',
    page: '2',
  });

  beforeEach(async () => {
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
            queryParamMap: of(queryParamMap),
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

    request.flush({
      items: [],
      total: 0,
      page: 2,
      per_page: 12,
    });

    expect(component.isLoading).toBeFalse();
    expect(component.page).toBe(2);
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
