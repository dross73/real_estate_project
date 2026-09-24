import { DOCUMENT } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpController: HttpTestingController;
  let mockDocument: Document;

  beforeEach(() => {
    mockDocument = {
      referrer: '',
      location: { hostname: 'juniper.example.com' },
    } as unknown as Document;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: DOCUMENT, useValue: mockDocument }],
    });

    service = TestBed.inject(AnalyticsService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should request the selected analytics range', () => {
    service.getOverview(90).subscribe();

    const request = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/analytics/overview' &&
        candidate.params.get('days') === '90',
    );

    expect(request.request.method).toBe('GET');
    request.flush({
      days: 90,
      start_at: '2026-06-25T00:00:00Z',
      end_at: '2026-09-23T00:00:00Z',
      granularity: 'weekly',
      metrics: {
        listing_views: 0,
        current_favorites: 0,
        inquiries: 0,
        showings: 0,
      },
      trend: [],
      top_listings: [],
      sources: [],
      referring_sites: [],
    });
  });

  it('should send only the external referrer hostname for a listing view', () => {
    mockDocument = {
      referrer: 'https://search.example.com/results?q=ames+homes',
      location: { hostname: 'juniper.example.com' },
    } as unknown as Document;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: DOCUMENT, useValue: mockDocument }],
    });
    service = TestBed.inject(AnalyticsService);
    httpController = TestBed.inject(HttpTestingController);

    service.recordListingView(27).subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/public/analytics/listing-views/27',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      referrer_host: 'search.example.com',
    });
    expect(JSON.stringify(request.request.body)).not.toContain('/results');
    request.flush(null);
  });
});
