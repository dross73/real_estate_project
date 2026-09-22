import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { ListingEngagementService } from '../../services/listing-engagement.service';
import { PublicInquiryService } from '../../services/public-inquiry.service';
import { SavedSearchService } from '../../services/saved-search.service';
import { PublicDashboardComponent } from './public-dashboard.component';

describe('PublicDashboardComponent', () => {
  let fixture: ComponentFixture<PublicDashboardComponent>;
  let component: PublicDashboardComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let engagementService: jasmine.SpyObj<ListingEngagementService>;
  let savedSearchService: jasmine.SpyObj<SavedSearchService>;
  let inquiryService: jasmine.SpyObj<PublicInquiryService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getPublicAccount',
    ]);
    engagementService = jasmine.createSpyObj<ListingEngagementService>(
      'ListingEngagementService',
      ['getFavorites', 'getRecentlyViewed'],
    );
    savedSearchService = jasmine.createSpyObj<SavedSearchService>(
      'SavedSearchService',
      ['list'],
    );
    inquiryService = jasmine.createSpyObj<PublicInquiryService>(
      'PublicInquiryService',
      ['list'],
    );

    authService.getPublicAccount.and.returnValue(
      of({
        id: 1,
        email: 'taylor@example.com',
        full_name: 'Taylor Morgan',
        phone: null,
        is_active: true,
        archived_at: null,
        role: 'public_user',
      }),
    );
    engagementService.getFavorites.and.returnValue(of({ items: [] }));
    engagementService.getRecentlyViewed.and.returnValue(of({ items: [] }));
    inquiryService.list.and.returnValue(
      of({
        items: [
          {
            id: 10,
            inquiry_type: 'showing',
            status: 'New',
            listing_id: 27,
            listing_title: 'Warm Craftsman Near Downtown',
            message: null,
            preferred_at: null,
            destination_label: 'Jane Morgan',
            created_at: '2026-09-22T00:00:00Z',
          },
        ],
        total: 1,
      }),
    );
    savedSearchService.list.and.returnValue(
      of({
        items: [
          {
            id: 4,
            name: 'Ames homes',
            criteria: { location: 'Ames' },
            alert_frequency: 'daily',
            alerts_enabled: true,
            last_alerted_at: null,
            created_at: '2026-09-22T00:00:00Z',
            updated_at: '2026-09-22T00:00:00Z',
          },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [PublicDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ListingEngagementService, useValue: engagementService },
        { provide: SavedSearchService, useValue: savedSearchService },
        { provide: PublicInquiryService, useValue: inquiryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should load only authenticated account collections into one dashboard', () => {
    fixture.detectChanges();

    expect(authService.getPublicAccount).toHaveBeenCalled();
    expect(engagementService.getFavorites).toHaveBeenCalled();
    expect(engagementService.getRecentlyViewed).toHaveBeenCalledWith(6);
    expect(savedSearchService.list).toHaveBeenCalled();
    expect(inquiryService.list).toHaveBeenCalled();
    expect(component.inquiries.length).toBe(1);
    expect(component.firstName).toBe('Taylor');
    expect(component.enabledAlertCount).toBe(1);
    expect(component.isLoading).toBeFalse();
  });

  it('should keep the dashboard usable when inquiry history fails', () => {
    inquiryService.list.and.returnValue(
      throwError(() => ({ status: 500 })),
    );

    fixture.detectChanges();

    expect(component.loadError).toBeFalse();
    expect(component.inquiriesLoadError).toBeTrue();
    expect(component.inquiries).toEqual([]);
  });

  it('should keep a usable error state when one dashboard request fails', () => {
    savedSearchService.list.and.returnValue(
      throwError(() => ({ status: 500 })),
    );

    fixture.detectChanges();

    expect(component.loadError).toBeTrue();
    expect(component.isLoading).toBeFalse();
  });
});
