import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SavedSearchService } from './saved-search.service';

describe('SavedSearchService', () => {
  let service: SavedSearchService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(SavedSearchService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should list saved searches for the signed-in user', () => {
    service.list().subscribe((response) => {
      expect(response.items).toEqual([]);
    });

    const request = httpController.expectOne(
      'http://localhost:8000/public/account/saved-searches',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [] });
  });

  it('should create, update, and delete saved searches', () => {
    service
      .create({
        name: 'Ames homes',
        criteria: { location: 'Ames', max_price: 500000 },
        alert_frequency: 'daily',
        alerts_enabled: true,
      })
      .subscribe();

    const createRequest = httpController.expectOne(
      'http://localhost:8000/public/account/saved-searches',
    );
    expect(createRequest.request.method).toBe('POST');
    createRequest.flush({
      id: 5,
      name: 'Ames homes',
      criteria: { location: 'Ames', max_price: 500000 },
      alert_frequency: 'daily',
      alerts_enabled: true,
      last_alerted_at: null,
      created_at: '2026-09-21T00:00:00Z',
      updated_at: '2026-09-21T00:00:00Z',
    });

    service.update(5, { alerts_enabled: false }).subscribe();

    const updateRequest = httpController.expectOne(
      'http://localhost:8000/public/account/saved-searches/5',
    );
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual({ alerts_enabled: false });
    updateRequest.flush({
      id: 5,
      name: 'Ames homes',
      criteria: { location: 'Ames', max_price: 500000 },
      alert_frequency: 'daily',
      alerts_enabled: false,
      last_alerted_at: null,
      created_at: '2026-09-21T00:00:00Z',
      updated_at: '2026-09-21T00:00:00Z',
    });

    service.delete(5).subscribe();

    const deleteRequest = httpController.expectOne(
      'http://localhost:8000/public/account/saved-searches/5',
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
  });
});
