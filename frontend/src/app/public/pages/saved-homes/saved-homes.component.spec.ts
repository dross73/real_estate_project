import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { ListingEngagementService } from '../../services/listing-engagement.service';
import { SavedHomesComponent } from './saved-homes.component';

describe('SavedHomesComponent', () => {
  let fixture: ComponentFixture<SavedHomesComponent>;
  let component: SavedHomesComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let engagementService: jasmine.SpyObj<ListingEngagementService>;

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

    await TestBed.configureTestingModule({
      imports: [SavedHomesComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ListingEngagementService, useValue: engagementService },
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
  });

  it('should load favorites and recently viewed for a signed-in public user', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');

    createComponent();

    expect(engagementService.getFavorites).toHaveBeenCalled();
    expect(engagementService.getRecentlyViewed).toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
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
