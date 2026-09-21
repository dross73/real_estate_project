import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { ListingEditComponent } from './listing-edit.component';
import { ListingService } from '../../../services/listing.service';

describe('ListingEditComponent', () => {
  let component: ListingEditComponent;
  let fixture: ComponentFixture<ListingEditComponent>;
  let listingService: jasmine.SpyObj<ListingService>;

  beforeEach(async () => {
    listingService = jasmine.createSpyObj<ListingService>('ListingService', [
      'getListingById',
      'updateListing',
    ]);

    await TestBed.configureTestingModule({
      imports: [ListingEditComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: ListingService, useValue: listingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should disable public visibility for internal-only statuses', () => {
    expect(component.listingForm.controls.is_public.disabled).toBeTrue();

    component.listingForm.controls.status.setValue('Pending');
    expect(component.listingForm.controls.is_public.enabled).toBeTrue();

    component.listingForm.controls.is_public.setValue(true);
    component.listingForm.controls.status.setValue('Draft');

    expect(component.listingForm.controls.is_public.disabled).toBeTrue();
    expect(component.listingForm.controls.is_public.value).toBeFalse();
  });
});
