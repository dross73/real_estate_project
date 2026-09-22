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

  function flushSiteSettings(
    overrides: Record<string, unknown> = {},
  ): void {
    const request = httpController.expectOne(
      'http://localhost:8000/public/site-settings',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      site_name: 'Juniper & Lane',
      site_descriptor: 'Realty',
      tagline: 'A brighter tomorrow belongs here.',
      logo_url: null,
      phone: null,
      email: null,
      address_line1: null,
      city: null,
      state: null,
      postal_code: null,
      homepage_eyebrow: 'Homes rooted in a brighter tomorrow',
      homepage_title: 'Local People. Lasting Places.',
      homepage_intro: 'Community-first guidance.',
      homepage_story_title: 'Rooted in community.',
      homepage_story_copy: 'Local relationships matter.',
      primary_color: '#13382b',
      secondary_color: '#738c78',
      show_about: true,
      show_contact: true,
      show_testimonials: false,
      enable_contact_requests: true,
      enable_showing_requests: true,
      listing_photo_max_count: 50,
      hard_listing_photo_max_count: 50,
      updated_at: null,
      ...overrides,
    });
  }

  it('should load featured listings on initialization', () => {
    flushSiteSettings();

    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);

    expect(component.isLoadingFeatured).toBeFalse();
    expect(component.featuredListings).toEqual([]);
  });

  it('should mark the featured section as failed when the API errors', () => {
    flushSiteSettings();

    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );
    request.flush('error', { status: 500, statusText: 'Server Error' });

    expect(component.featuredLoadError).toBeTrue();
    expect(component.isLoadingFeatured).toBeFalse();
  });

  it('should apply configured homepage copy and feature visibility', () => {
    flushSiteSettings({
      homepage_title: 'Configured Home Title',
      show_about: false,
      show_contact: false,
    });

    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );
    request.flush([]);

    expect(component.content.hero.title).toBe('Configured Home Title');
    expect(component.showAbout).toBeFalse();
    expect(component.showContact).toBeFalse();
  });

  it('should navigate search values to the listings query string', () => {
    flushSiteSettings();

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
