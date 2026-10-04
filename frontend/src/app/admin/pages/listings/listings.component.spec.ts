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
    expect(listingService.getListings).toHaveBeenCalledWith(1, 10, '', '');
    expect(component.isLoading).toBeFalse();
  });

  it('should reset to page one and send the status filter to the backend', () => {
    listingService.getListings.calls.reset();
    component.currentPage = 3;
    component.statusFilter = 'Sold';

    component.onFiltersChange();

    expect(component.currentPage).toBe(1);
    expect(listingService.getListings).toHaveBeenCalledWith(1, 10, '', 'Sold');
  });

  it('should request the next page only when another page exists', () => {
    listingService.getListings.calls.reset();
    listingService.getListings.and.returnValue(
      of({
        items: [],
        total: 25,
        page: 2,
        per_page: 10,
      }),
    );
    component.totalListings = 25;
    component.perPage = 10;
    component.currentPage = 1;

    component.nextPage();

    expect(component.currentPage).toBe(2);
    expect(listingService.getListings).toHaveBeenCalledWith(2, 10, '', '');
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
