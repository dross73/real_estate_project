import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { ListingEngagementService } from '../../services/listing-engagement.service';
import { SavedSearchService } from '../../services/saved-search.service';
import { SavedHomesComponent } from './saved-homes.component';

describe('SavedHomesComponent', () => {
  let fixture: ComponentFixture<SavedHomesComponent>;
  let component: SavedHomesComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let engagementService: jasmine.SpyObj<ListingEngagementService>;
  let savedSearchService: jasmine.SpyObj<SavedSearchService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated',
      'getUserRole',
    ]);
    engagementService = jasmine.createSpyObj<ListingEngagementService>(
      'ListingEngagementService',
      ['getFavorites', 'getRecentlyViewed', 'removeFavorite'],
    );

    engagementService.getFavorites.and.returnValue(of({ items: [] }));
    engagementService.getRecentlyViewed.and.returnValue(of({ items: [] }));

    savedSearchService = jasmine.createSpyObj<SavedSearchService>(
      'SavedSearchService',
      ['list', 'update', 'delete'],
    );
    savedSearchService.list.and.returnValue(of({ items: [] }));

    await TestBed.configureTestingModule({
      imports: [SavedHomesComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ListingEngagementService, useValue: engagementService },
        { provide: SavedSearchService, useValue: savedSearchService },
      ],
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(SavedHomesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should not call protected APIs when no public user is signed in', () => {
    authService.isAuthenticated.and.returnValue(false);
    authService.getUserRole.and.returnValue(null);

    createComponent();

    expect(engagementService.getFavorites).not.toHaveBeenCalled();
    expect(engagementService.getRecentlyViewed).not.toHaveBeenCalled();
    expect(savedSearchService.list).not.toHaveBeenCalled();
  });

  it('should load favorites and recently viewed for a signed-in public user', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');

    createComponent();

    expect(engagementService.getFavorites).toHaveBeenCalled();
    expect(engagementService.getRecentlyViewed).toHaveBeenCalled();
    expect(savedSearchService.list).toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('should pause a saved-search alert without deleting the search', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');

    const savedSearch = {
      id: 4,
      name: 'Ames homes',
      criteria: { location: 'Ames' },
      alert_frequency: 'daily' as const,
      alerts_enabled: true,
      last_alerted_at: null,
      created_at: '2026-09-21T00:00:00Z',
      updated_at: '2026-09-21T00:00:00Z',
    };

    savedSearchService.list.and.returnValue(of({ items: [savedSearch] }));
    savedSearchService.update.and.returnValue(
      of({ ...savedSearch, alerts_enabled: false }),
    );

    createComponent();
    component.toggleSearchAlerts(savedSearch);

    expect(savedSearchService.update).toHaveBeenCalledWith(4, {
      alerts_enabled: false,
    });
    expect(component.savedSearches[0].alerts_enabled).toBeFalse();
  });

  it('should show verification guidance when the API rejects access', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');
    engagementService.getFavorites.and.returnValue(
      throwError(() => ({ status: 403 })),
    );

    createComponent();

    expect(component.accessError).toContain('Verify your email');
    expect(component.loadError).toBeFalse();
  });
});
