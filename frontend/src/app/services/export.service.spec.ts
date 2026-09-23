import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ExportService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should pass the active lead filters to the CSV export', () => {
    service
      .exportLeads({
        status: 'New',
        inquiry_type: 'showing',
        q: 'Taylor',
      })
      .subscribe();

    const request = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/exports/leads.csv' &&
        candidate.params.get('status') === 'New' &&
        candidate.params.get('inquiry_type') === 'showing' &&
        candidate.params.get('q') === 'Taylor',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['lead_id\n1\n'], { type: 'text/csv' }));
  });

  it('should pass the selected analytics range to the CSV export', () => {
    service.exportAnalytics(90).subscribe();

    const request = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/exports/analytics.csv' &&
        candidate.params.get('days') === '90',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['record_type\nsummary\n'], { type: 'text/csv' }));
  });
});
