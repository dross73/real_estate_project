import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { Listing, PaginatedListingsResponse } from '../../../models/listing';
import { User } from '../../../models/user';
import { AuthService } from '../../../services/auth.service';
import { ListingService } from '../../../services/listing.service';
import { UserService } from '../../../services/user.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let listingService: jasmine.SpyObj<ListingService>;
  let userService: jasmine.SpyObj<UserService>;
  let authService: jasmine.SpyObj<AuthService>;

  function listing(overrides: Partial<Listing>): Listing {
    return {
      id: 0,
      title: 'Test Listing',
      status: 'Draft',
      is_public: false,
      is_featured: false,
      hide_exact_address: false,
      price: 0,
      property_type: null,
      address: '123 Test Street',
      city: 'Ames',
      state: 'IA',
      description: null,
      sqft: null,
      acreage: null,
      year_built: null,
      bedrooms: 0,
      bathrooms: 0,
      annual_property_taxes: null,
      hoa_fee: null,
      hoa_fee_frequency: null,
      school_district: null,
      amenities: [],
      mls_number: null,
      source_attribution: null,
      cover_image: null,
      created_at: null,
      updated_at: null,
      ...overrides,
    };
  }

  const listings: Listing[] = [
    listing({
      id: 1,
      title: 'Maple Street Home',
      status: 'Active',
      price: 285000,
      address: '123 Maple Street',
      city: 'Des Moines',
      sqft: 1800,
      bedrooms: 3,
      bathrooms: 2,
    }),
    listing({
      id: 2,
      title: 'Oak Avenue Home',
      status: 'Pending',
      price: 342000,
      address: '456 Oak Avenue',
      city: 'Ames',
      sqft: 2100,
      bedrooms: 4,
      bathrooms: 2.5,
    }),
    listing({
      id: 3,
      title: 'Pine Lane Home',
      price: 410000,
      address: '789 Pine Lane',
      city: 'West Des Moines',
      sqft: 2400,
      bedrooms: 4,
      bathrooms: 3,
    }),
  ];

  const listingResponse: PaginatedListingsResponse = {
    items: listings,
    total: 8,
    page: 1,
    per_page: 3,
  };

  const users: User[] = [
    {
      id: 1,
      email: 'admin@example.com',
      full_name: 'Admin User',
      is_active: true,
      archived_at: null,
      role: 'admin',
    },
    {
      id: 2,
      email: 'staff@example.com',
      full_name: 'Staff User',
      is_active: true,
      archived_at: null,
      role: 'staff',
    },
    {
      id: 3,
      email: 'inactive@example.com',
      full_name: 'Inactive User',
      is_active: false,
      archived_at: null,
      role: 'staff',
    },
  ];

  beforeEach(async () => {
    listingService = jasmine.createSpyObj<ListingService>('ListingService', [
      'getListings',
    ]);
    userService = jasmine.createSpyObj<UserService>('UserService', ['getUsers']);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAdmin']);

    listingService.getListings.and.returnValue(of(listingResponse));
    userService.getUsers.and.returnValue(of(users));
    authService.isAdmin.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ListingService, useValue: listingService },
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  function createDashboard(): void {
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createDashboard();

    expect(component).toBeTruthy();
  });

  it('should load the total listing count and listing snapshot', () => {
    createDashboard();

    expect(listingService.getListings).toHaveBeenCalledWith(1, 3);
    expect(component.totalListings).toBe(8);
    expect(component.listingSnapshot).toEqual(listings);
  });

  it('should count only active users for admins', () => {
    createDashboard();

    expect(userService.getUsers).toHaveBeenCalled();
    expect(component.activeUsers).toBe(2);
  });

  it('should not request users for staff', () => {
    authService.isAdmin.and.returnValue(false);

    createDashboard();

    expect(component.isAdmin).toBeFalse();
    expect(userService.getUsers).not.toHaveBeenCalled();
  });

  it('should expose a listing error without breaking the dashboard', () => {
    listingService.getListings.and.returnValue(
      throwError(() => new Error('API unavailable')),
    );

    createDashboard();

    expect(component.isListingsLoading).toBeFalse();
    expect(component.listingSnapshot).toEqual([]);
    expect(component.listingsErrorMessage).toContain(
      'Unable to load listing information',
    );
  });
});
