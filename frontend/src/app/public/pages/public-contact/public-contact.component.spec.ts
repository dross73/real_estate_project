import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicInquiryService } from '../../services/public-inquiry.service';
import { PublicListingService } from '../../services/public-listing.service';
import { PublicContactComponent } from './public-contact.component';

describe('PublicContactComponent', () => {
  let fixture: ComponentFixture<PublicContactComponent>;
  let component: PublicContactComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let settingsService: jasmine.SpyObj<SiteSettingsService>;
  let listingService: jasmine.SpyObj<PublicListingService>;
  let inquiryService: jasmine.SpyObj<PublicInquiryService>;

  const settings = {
    site_name: 'Juniper & Lane',
    site_descriptor: 'Realty',
    tagline: 'A brighter tomorrow belongs here.',
    logo_url: null,
    phone: '515-555-0100',
    email: 'hello@example.com',
    address_line1: '100 Main Street',
    city: 'Ames',
    state: 'IA',
    postal_code: '50010',
    homepage_eyebrow: null,
    homepage_title: null,
    homepage_intro: null,
    homepage_story_title: null,
    homepage_story_copy: null,
    contact_hours: 'Monday-Friday, 9:00 AM-5:00 PM',
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
  };

  const listing = {
    id: 27,
    title: 'Warm Craftsman Near Downtown',
    status: 'Active' as const,
    is_featured: false,
    hide_exact_address: false,
    price: 425000,
    property_type: 'Single Family' as const,
    address: '123 Main St',
    city: 'Ames',
    state: 'IA',
    description: null,
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
    cover_image: null,
    agent: {
      id: 3,
      full_name: 'Jane Morgan',
      professional_title: 'REALTOR',
      email: 'jane@example.com',
      phone: null,
      photo_url: null,
      office_name: null,
    },
    created_at: null,
    updated_at: null,
  };

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated',
      'getUserRole',
      'getPublicAccount',
    ]);
    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');
    authService.getPublicAccount.and.returnValue(
      of({
        id: 9,
        email: 'buyer@example.com',
        full_name: 'Buyer Person',
        phone: '515-555-0199',
        is_active: true,
        archived_at: null,
        role: 'public_user',
      }),
    );

    settingsService = jasmine.createSpyObj<SiteSettingsService>(
      'SiteSettingsService',
      ['getPublicSettings'],
    );
    settingsService.getPublicSettings.and.returnValue(of(settings));

    listingService = jasmine.createSpyObj<PublicListingService>(
      'PublicListingService',
      ['getListingById'],
    );
    listingService.getListingById.and.returnValue(of(listing));

    inquiryService = jasmine.createSpyObj<PublicInquiryService>(
      'PublicInquiryService',
      ['submit'],
    );
    inquiryService.submit.and.returnValue(
      of({
        id: 10,
        inquiry_type: 'showing',
        status: 'New',
        listing_id: 27,
        listing_title: listing.title,
        message: 'Saturday afternoon.',
        preferred_at: null,
        destination_label: 'Jane Morgan',
        created_at: '2026-09-22T00:00:00Z',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [PublicContactComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                intent: 'showing',
                listing: '27',
              }),
            },
          },
        },
        { provide: AuthService, useValue: authService },
        { provide: SiteSettingsService, useValue: settingsService },
        { provide: PublicListingService, useValue: listingService },
        { provide: PublicInquiryService, useValue: inquiryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the listing, account, and configured showing feature', () => {
    expect(component.inquiryType).toBe('showing');
    expect(component.listing?.id).toBe(27);
    expect(component.account?.email).toBe('buyer@example.com');
    expect(component.featureEnabled).toBeTrue();
    expect(component.destinationLabel).toBe('Jane Morgan');
    expect(component.pageVisible).toBeTrue();
    expect(component.officeLocation).toContain('100 Main Street');
    expect(decodeURIComponent(component.officeMapUrl)).toContain(
      '100 Main Street',
    );
  });

  it('should keep showing requests available independently of the general contact page', () => {
    component.settings = {
      ...settings,
      show_contact: false,
    };

    expect(component.inquiryType).toBe('showing');
    expect(component.pageVisible).toBeTrue();
  });

  it('should submit once and keep the success state from being duplicated', () => {
    component.form.controls.message.setValue('Saturday afternoon.');

    component.submit();
    component.submit();

    expect(inquiryService.submit).toHaveBeenCalledTimes(1);
    expect(inquiryService.submit).toHaveBeenCalledWith(
      jasmine.objectContaining({
        inquiry_type: 'showing',
        listing_id: 27,
        message: 'Saturday afternoon.',
      }),
    );
    expect(component.submittedInquiry?.id).toBe(10);
  });

  it('should respect a disabled showing-request setting', () => {
    component.settings = {
      ...settings,
      enable_showing_requests: false,
    };

    component.submit();

    expect(inquiryService.submit).not.toHaveBeenCalled();
    expect(component.featureEnabled).toBeFalse();
  });
});
