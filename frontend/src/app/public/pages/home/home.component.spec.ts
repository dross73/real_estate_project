import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let httpController: HttpTestingController;
  let router: Router;

  const primaryPhoto = {
    id: 8,
    position: 0,
    is_primary: true,
    thumbnail_url: 'https://media.example/home-thumbnail.webp',
    medium_url: 'https://media.example/home-medium.webp',
    large_url: 'https://media.example/home-large.webp',
  };

  const featuredListing = {
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
      enable_testimonial_submissions: false,
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

  it('should render the four community images with descriptive alt text and location-filtered links', () => {
    flushSiteSettings();
    httpController.expectOne('http://localhost:8000/public/listings/featured?limit=4').flush([]);
    fixture.detectChanges();

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.community-card')) as HTMLAnchorElement[];
    expect(cards.length).toBe(4);
    for (const [index, [name, filename]] of [
      ['Story City', 'story-city-community.webp'],
      ['Ames', 'ames-community.webp'],
      ['Huxley', 'huxley-community.webp'],
      ['Ankeny', 'ankeny-community.webp'],
    ].entries()) {
      const card = cards[index];
      const url = new URL(card.href);
      const image = card.querySelector('img')!;
      expect(card.querySelector('strong')?.textContent).toBe(name);
      expect(url.pathname).toBe('/listings');
      expect(url.searchParams.get('location')).toBe(name);
      expect(Array.from(url.searchParams.keys())).toEqual(['location']);
      expect(image.getAttribute('src')).toBe(`/images/communities/${filename}`);
      expect(image.alt).toContain(name);
      expect(image.alt.length).toBeGreaterThan(name.length);
      expect(image.loading).toBe('lazy');
      expect(image.hasAttribute('aria-hidden')).toBeFalse();
    }
  });

  it('should render dated Story County figures and link to the report when contact is disabled', () => {
    flushSiteSettings({ show_contact: false });
    httpController.expectOne('http://localhost:8000/public/listings/featured?limit=4').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.market-panel h2').textContent)
      .toBe('Story County Market Snapshot');
    const values = Array.from(fixture.nativeElement.querySelectorAll('.market-stat strong')) as HTMLElement[];
    expect(values.map(value => value.textContent)).toEqual(['$322,500', '47', '99%']);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.market-stat span')) as HTMLElement[];
    expect(labels.map(label => label.textContent)).toEqual(['Median sold price', 'Median days on market', 'Sale-to-list ratio']);
    const source = fixture.nativeElement.querySelector('.market-panel__source') as HTMLElement;
    expect(source.textContent).toContain('Data period: September 2026');
    expect(source.textContent).toContain('Realtor.com Economic Research');
    expect(source.querySelector('a')?.href).toBe('https://www.realtor.com/local/market/iowa/story-county');
    const link = fixture.nativeElement.querySelector('a[href="/market-report"]') as HTMLAnchorElement;
    expect(link.textContent).toBe('View Market Report');
  });

  it('should render the medium primary photo for a featured listing', () => {
    flushSiteSettings();

    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );
    request.flush([featuredListing]);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
      'img.listing-card__image',
    ) as HTMLImageElement | null;

    expect(image).not.toBeNull();
    expect(image?.src).toContain('home-medium.webp');
  });

  it('should render the featured-card placeholder when no primary photo exists', () => {
    flushSiteSettings();

    const request = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );
    request.flush([
      {
        ...featuredListing,
        photos: [],
        primary_photo: null,
      },
    ]);
    fixture.detectChanges();

    const placeholder = fixture.nativeElement.querySelector(
      '.listing-card__image--placeholder',
    );

    expect(placeholder).not.toBeNull();
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

  it('should load approved testimonials when the section is enabled', () => {
    flushSiteSettings({
      show_testimonials: true,
      enable_testimonial_submissions: true,
    });

    const featuredRequest = httpController.expectOne(
      'http://localhost:8000/public/listings/featured?limit=4',
    );
    featuredRequest.flush([]);

    const testimonialRequest = httpController.expectOne(
      'http://localhost:8000/public/testimonials?limit=6',
    );
    expect(testimonialRequest.request.method).toBe('GET');
    testimonialRequest.flush([
      {
        id: 4,
        author_name: 'Alex Customer',
        body: 'Thoughtful guidance from start to finish.',
        rating: 5,
        created_at: '2026-09-22T23:00:00Z',
      },
    ]);

    expect(component.showTestimonials).toBeTrue();
    expect(component.enableTestimonialSubmissions).toBeTrue();
    expect(component.testimonials.length).toBe(1);
    expect(component.testimonials[0].author_name).toBe('Alex Customer');
  });

  it('should submit the property-search form to the listings query string', () => {
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

    fixture.nativeElement.querySelector('form.property-search')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

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
