import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let httpController: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    httpController = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    fixture.detectChanges();
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should load featured listings on initialization', () => {
    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);

    expect(component.isLoadingFeatured).toBeFalse();
    expect(component.featuredListings).toEqual([]);
  });

  it('should mark the featured section as failed when the API errors', () => {
    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );
    request.flush('error', { status: 500, statusText: 'Server Error' });

    expect(component.featuredLoadError).toBeTrue();
    expect(component.isLoadingFeatured).toBeFalse();
  });

  it('should navigate search values to the listings query string', () => {
    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );
    request.flush([]);

    spyOn(router, 'navigate').and.resolveTo(true);

    component.searchForm.setValue({
      location: 'Riverton',
      minPrice: '300000',
      maxPrice: '750000',
      bedrooms: '3',
      propertyType: 'Single Family',
    });

    component.searchListings();

    expect(router.navigate).toHaveBeenCalledWith(['/listings'], {
      queryParams: {
        location: 'Riverton',
        min_price: '300000',
        max_price: '750000',
        min_bedrooms: '3',
        property_type: 'Single Family',
      },
    });
  });
});
