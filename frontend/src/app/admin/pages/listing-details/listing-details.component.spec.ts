import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ListingService } from '../../../services/listing.service';
import { ListingDetailsComponent } from './listing-details.component';

describe('ListingDetailsComponent open houses', () => {
  let fixture: ComponentFixture<ListingDetailsComponent>;
  let component: ListingDetailsComponent;
  let listingService: jasmine.SpyObj<ListingService>;

  const listing = {
    id: 27,
    title: 'Open House Test Home',
    status: 'Active' as const,
    is_public: true,
    is_featured: false,
    hide_exact_address: false,
    agent_id: null,
    office_id: null,
    price: 425000,
    property_type: 'Single Family' as const,
    address: '123 Main St',
    city: 'Ames',
    state: 'IA',
    description: null,
    sqft: 1800,
    acreage: null,
    year_built: 2000,
    bedrooms: 3,
    bathrooms: 2,
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
  };

  const upcoming = {
    id: 4,
    listing_id: 27,
    starts_at: '2099-10-01T18:00:00.000Z',
    ends_at: '2099-10-01T20:00:00.000Z',
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
  };

  const past = {
    id: 3,
    listing_id: 27,
    starts_at: '2020-10-01T18:00:00.000Z',
    ends_at: '2020-10-01T20:00:00.000Z',
    created_at: '2020-09-22T00:00:00Z',
    updated_at: '2020-09-22T00:00:00Z',
  };

  beforeEach(async () => {
    listingService = jasmine.createSpyObj<ListingService>('ListingService', [
      'getListingById',
      'getOpenHouses',
      'createOpenHouse',
      'updateOpenHouse',
      'deleteOpenHouse',
      'deleteListing',
    ]);

    listingService.getListingById.and.returnValue(of(listing));
    listingService.getOpenHouses.and.returnValue(of([past, upcoming]));
    listingService.createOpenHouse.and.returnValue(of(upcoming));
    listingService.updateOpenHouse.and.returnValue(of(upcoming));
    listingService.deleteOpenHouse.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [ListingDetailsComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '27' }),
            },
          },
        },
        { provide: ListingService, useValue: listingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load and distinguish upcoming and past events', () => {
    expect(listingService.getListingById).toHaveBeenCalledWith(27);
    expect(listingService.getOpenHouses).toHaveBeenCalledWith(27);
    expect(component.upcomingOpenHouses.map((event) => event.id)).toEqual([4]);
    expect(component.pastOpenHouses.map((event) => event.id)).toEqual([3]);
  });

  it('should create a future open house from local date inputs', () => {
    component.openHouseForm.setValue({
      startsAt: '2099-10-02T13:00',
      endsAt: '2099-10-02T15:00',
    });

    component.saveOpenHouse();

    expect(listingService.createOpenHouse).toHaveBeenCalledWith(
      27,
      jasmine.objectContaining({
        starts_at: jasmine.any(String),
        ends_at: jasmine.any(String),
      }),
    );
    expect(component.openHouseError).toBe('');
  });

  it('should reject an end time that is not after the start time', () => {
    component.openHouseForm.setValue({
      startsAt: '2099-10-02T15:00',
      endsAt: '2099-10-02T13:00',
    });

    component.saveOpenHouse();

    expect(listingService.createOpenHouse).not.toHaveBeenCalled();
    expect(component.openHouseError).toContain('end time');
  });

  it('should update an event after edit is selected', () => {
    component.editOpenHouse(upcoming);
    component.openHouseForm.controls.endsAt.setValue('2099-10-01T21:00');

    component.saveOpenHouse();

    expect(listingService.updateOpenHouse).toHaveBeenCalledWith(
      27,
      4,
      jasmine.objectContaining({
        starts_at: jasmine.any(String),
        ends_at: jasmine.any(String),
      }),
    );
  });
});
