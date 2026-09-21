import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ListingEngagementService } from './listing-engagement.service';

describe('ListingEngagementService', () => {
  let service: ListingEngagementService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(ListingEngagementService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should load the current user favorites', () => {
    service.getFavorites().subscribe((response) => {
      expect(response.items).toEqual([]);
    });

    const request = httpController.expectOne(
      'http://localhost:8000/public/account/favorites',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [] });
  });

  it('should add and remove one favorite by listing ID', () => {
    service.addFavorite(27).subscribe((response) => {
      expect(response.is_favorite).toBeTrue();
    });

    const addRequest = httpController.expectOne(
      'http://localhost:8000/public/account/favorites/27',
    );
    expect(addRequest.request.method).toBe('PUT');
    addRequest.flush({ listing_id: 27, is_favorite: true });

    service.removeFavorite(27).subscribe();

    const removeRequest = httpController.expectOne(
      'http://localhost:8000/public/account/favorites/27',
    );
    expect(removeRequest.request.method).toBe('DELETE');
    removeRequest.flush(null);
  });

  it('should record and load recently viewed listings', () => {
    service.recordRecentlyViewed(27).subscribe();

    const recordRequest = httpController.expectOne(
      'http://localhost:8000/public/account/recently-viewed/27',
    );
    expect(recordRequest.request.method).toBe('POST');
    recordRequest.flush(null);

    service.getRecentlyViewed(6).subscribe((response) => {
      expect(response.items).toEqual([]);
    });

    const listRequest = httpController.expectOne(
      (request) =>
        request.url ===
          'http://localhost:8000/public/account/recently-viewed' &&
        request.params.get('limit') === '6',
    );
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush({ items: [] });
  });
});
