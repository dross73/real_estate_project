import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of } from 'rxjs';

import { PublicListingsComponent } from './public-listings.component';

describe('PublicListingsComponent', () => {
  let fixture: ComponentFixture<PublicListingsComponent>;
  let component: PublicListingsComponent;
  let httpController: HttpTestingController;
  let router: Router;

  const queryParamMap = convertToParamMap({
    location: 'Ames',
    min_price: '250000',
    min_bedrooms: '3',
    sort: 'price_asc',
    page: '2',
  });

  beforeEach(async () => {
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
