import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ListingsComponent } from './listings.component';
import { ListingService } from '../../../services/listing.service';

describe('ListingsComponent', () => {
  let component: ListingsComponent;
  let fixture: ComponentFixture<ListingsComponent>;
  let listingService: jasmine.SpyObj<ListingService>;

  beforeEach(async () => {
    listingService = jasmine.createSpyObj<ListingService>('ListingService', [
      'getListings',
    ]);
    listingService.getListings.and.returnValue(
      of({
        items: [],
        total: 0,
        page: 1,
        per_page: 10,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [ListingsComponent],
      providers: [
        provideRouter([]),
        { provide: ListingService, useValue: listingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load the first page', () => {
    expect(component).toBeTruthy();
    expect(listingService.getListings).toHaveBeenCalledWith(1, 10);
    expect(component.isLoading).toBeFalse();
  });

  it('should filter loaded listings by text and lifecycle status', () => {
    component.listings = [
      {
        id: 1,
        title: 'Maple Street Home',
        status: 'Active',
        is_public: true,
        is_featured: false,
        hide_exact_address: false,
        price: 300000,
        property_type: 'Single Family',
        address: '123 Maple Street',
        city: 'Ames',
        state: 'IA',
        description: null,
        sqft: null,
        acreage: null,
        year_built: null,
        bedrooms: 3,
        bathrooms: 2,
        annual_property_taxes: null,
        hoa_fee: null,
        hoa_fee_frequency: null,
        school_district: null,
        amenities: [],
        mls_number: 'MLS-1',
        source_attribution: null,
        cover_image: null,
        created_at: null,
        updated_at: null,
      },
      {
        id: 2,
        title: 'Oak Lane Home',
        status: 'Sold',
        is_public: true,
        is_featured: false,
        hide_exact_address: false,
        price: 350000,
        property_type: 'Single Family',
        address: '50 Oak Lane',
        city: 'Story City',
        state: 'IA',
        description: null,
        sqft: null,
        acreage: null,
        year_built: null,
        bedrooms: 4,
        bathrooms: 2,
        annual_property_taxes: null,
        hoa_fee: null,
        hoa_fee_frequency: null,
        school_district: null,
        amenities: [],
        mls_number: 'MLS-2',
        source_attribution: null,
        cover_image: null,
        created_at: null,
        updated_at: null,
      },
    ];

    component.searchTerm = 'story';
    component.statusFilter = 'Sold';

    expect(component.filteredListings.map((listing) => listing.id)).toEqual([
      2,
    ]);
  });

  it('should request the next page only when another page exists', () => {
    listingService.getListings.calls.reset();
    component.totalListings = 25;
    component.perPage = 10;
    component.currentPage = 1;

    component.nextPage();

    expect(component.currentPage).toBe(2);
    expect(listingService.getListings).toHaveBeenCalledWith(2, 10);
  });

  it('should expose a load error without leaving the page busy', () => {
    listingService.getListings.and.returnValue(
      throwError(() => new Error('offline')),
    );

    component.loadListings();

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toContain('Unable to load listings');
  });
});
