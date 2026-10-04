import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Listing } from '../../../models/listing';
import { AgentService } from '../../../services/agent.service';
import { ListingPhotoService } from '../../../services/listing-photo.service';
import { ListingPhotoTransferService } from '../../../services/listing-photo-transfer.service';
import { ListingService } from '../../../services/listing.service';
import { OfficeService } from '../../../services/office.service';
import { ListingCreateComponent } from './listing-create.component';

describe('ListingCreateComponent', () => {
  let component: ListingCreateComponent;
  let fixture: ComponentFixture<ListingCreateComponent>;
  let listingService: jasmine.SpyObj<ListingService>;
  let agentService: jasmine.SpyObj<AgentService>;
  let officeService: jasmine.SpyObj<OfficeService>;
  let photoService: jasmine.SpyObj<ListingPhotoService>;
  let photoTransferService: jasmine.SpyObj<ListingPhotoTransferService>;
  let router: Router;

  // Use one complete backend response for create-flow tests.
  const createdListing: Listing = {
    id: 42,
    title: '123 Main Street',
    status: 'Draft',
    is_public: false,
    is_featured: false,
    hide_exact_address: false,
    agent_id: null,
    office_id: null,
    price: 250000,
    property_type: 'Single Family',
    address: '123 Main Street',
    city: 'Story City',
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
    mls_number: null,
    source_attribution: null,
    cover_image: null,
    virtual_tour_url: null,
    created_at: '2026-09-28T00:00:00Z',
    updated_at: '2026-09-28T00:00:00Z',
  };

  beforeEach(async () => {
    agentService = jasmine.createSpyObj<AgentService>('AgentService', ['getAgents']);
    agentService.getAgents.and.returnValue(of([]));

    officeService = jasmine.createSpyObj<OfficeService>('OfficeService', [
      'getOffices',
    ]);
    officeService.getOffices.and.returnValue(of([]));

    listingService = jasmine.createSpyObj<ListingService>('ListingService', [
      'createListing',
    ]);

    // The embedded photo component loads backend limits even before a listing ID exists.
    photoService = jasmine.createSpyObj<ListingPhotoService>(
      'ListingPhotoService',
      [
        'getUploadSettings',
        'getPhotos',
        'uploadPhoto',
        'reorderPhotos',
        'setPrimaryPhoto',
        'deletePhoto',
        'replacePhoto',
      ],
    );
    photoService.getUploadSettings.and.returnValue(
      of({
        max_photos: 30,
        max_file_bytes: 10 * 1024 * 1024,
        accepted_extensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
      }),
    );

    photoTransferService = jasmine.createSpyObj<ListingPhotoTransferService>(
      'ListingPhotoTransferService',
      ['stage', 'take', 'clear'],
    );
    photoTransferService.take.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [ListingCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ListingService, useValue: listingService },
        { provide: AgentService, useValue: agentService },
        { provide: OfficeService, useValue: officeService },
        { provide: ListingPhotoService, useValue: photoService },
        { provide: ListingPhotoTransferService, useValue: photoTransferService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingCreateComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  // Fill only the fields required by the create form so submission tests stay focused.
  function fillRequiredListingFields(): void {
    component.listingForm.patchValue({
      title: '123 Main Street',
      price: 250000,
      property_type: 'Single Family',
      address: '123 Main Street',
      city: 'Story City',
      state: 'IA',
      bedrooms: 3,
      bathrooms: 2,
    });
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default a new listing to the sole active office', () => {
    officeService.getOffices.and.returnValue(
      of([
        {
          id: 3,
          name: 'Story City Office',
          address_line1: '100 Broad St',
          city: 'Story City',
          state: 'IA',
          postal_code: '50248',
          phone: null,
          email: null,
          hours: null,
          is_active: true,
          is_public: true,
          created_at: '2026-09-22T00:00:00Z',
          updated_at: '2026-09-22T00:00:00Z',
        },
      ]),
    );

    component.ngOnInit();

    expect(component.listingForm.controls.office_id.value).toBe(3);
  });

  it('should keep Draft internal-only and enable visibility for Active', () => {
    expect(component.listingForm.controls.is_public.disabled).toBeTrue();
    expect(component.listingForm.controls.is_public.value).toBeFalse();

    component.listingForm.controls.status.setValue('Active');

    expect(component.listingForm.controls.is_public.enabled).toBeTrue();

    component.listingForm.controls.is_public.setValue(true);
    component.listingForm.controls.status.setValue('Archived');

    expect(component.listingForm.controls.is_public.disabled).toBeTrue();
    expect(component.listingForm.controls.is_public.value).toBeFalse();
  });

  it('should create a listing with no photos and continue to Edit Listing', () => {
    fillRequiredListingFields();
    listingService.createListing.and.returnValue(of(createdListing));
    spyOn(router, 'navigate').and.resolveTo(true);

    component.onSubmit();

    expect(listingService.createListing).toHaveBeenCalled();
    expect(photoTransferService.stage).not.toHaveBeenCalled();
    expect(photoTransferService.clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/listings', 42, 'edit'],
      { queryParams: { created: 1 } },
    );
  });

  it('should preserve the selected photo order for upload after creation', () => {
    fillRequiredListingFields();
    listingService.createListing.and.returnValue(of(createdListing));
    spyOn(router, 'navigate').and.resolveTo(true);

    const firstFile = new File(['front'], 'front.jpg', { type: 'image/jpeg' });
    const secondFile = new File(['kitchen'], 'kitchen.jpg', {
      type: 'image/jpeg',
    });
    component.onDraftFilesChange([secondFile, firstFile]);

    component.onSubmit();

    expect(photoTransferService.stage).toHaveBeenCalledWith(42, [
      secondFile,
      firstFile,
    ]);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/listings', 42, 'edit'],
      { queryParams: { created: 1 } },
    );
  });

  it('should keep listing-save errors separate from photo upload handling', () => {
    fillRequiredListingFields();
    listingService.createListing.and.returnValue(
      throwError(() => new Error('Create failed')),
    );

    component.onSubmit();

    expect(component.errorMessage).toBe(
      'Unable to create listing. Please try again.',
    );
    expect(component.isSubmitting).toBeFalse();
    expect(photoTransferService.stage).not.toHaveBeenCalled();
  });
});
