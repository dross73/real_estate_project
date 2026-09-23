import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AnalyticsOverview } from '../../../models/analytics';
import { AnalyticsService } from '../../../services/analytics.service';
import { ExportService } from '../../../services/export.service';
import { AnalyticsComponent } from './analytics.component';

describe('AnalyticsComponent', () => {
  let fixture: ComponentFixture<AnalyticsComponent>;
  let component: AnalyticsComponent;
  let service: jasmine.SpyObj<AnalyticsService>;
  let exportService: jasmine.SpyObj<ExportService>;

  const overview: AnalyticsOverview = {
    days: 30,
    start_at: '2026-08-24T00:00:00Z',
    end_at: '2026-09-23T00:00:00Z',
    granularity: 'daily',
    metrics: {
      listing_views: 120,
      current_favorites: 12,
      inquiries: 8,
      showings: 3,
    },
    trend: [
      {
        period_start: '2026-09-22',
        listing_views: 10,
        inquiries: 2,
      },
    ],
    top_listings: [
      {
        listing_id: 27,
        title: 'Warm Craftsman Near Downtown',
        city: 'Ames',
        state: 'IA',
        views: 44,
        favorites: 5,
        inquiries: 2,
      },
    ],
    sources: [
      { category: 'direct', count: 70 },
      { category: 'search', count: 30 },
      { category: 'social', count: 10 },
      { category: 'referral', count: 10 },
    ],
    referring_sites: [
      { host: 'broker.example.com', count: 4 },
    ],
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', [
      'getOverview',
    ]);
    service.getOverview.and.returnValue(of(overview));

    exportService = jasmine.createSpyObj<ExportService>('ExportService', [
      'exportAnalytics',
      'saveCsv',
    ]);
    exportService.exportAnalytics.and.returnValue(
      of(new Blob(['record_type\nsummary\n'], { type: 'text/csv' })),
    );

    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent],
      providers: [
        { provide: AnalyticsService, useValue: service },
        { provide: ExportService, useValue: exportService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the approved analytics overview range', () => {
    expect(service.getOverview).toHaveBeenCalledWith(30);
    expect(component.overview?.metrics.listing_views).toBe(120);
    expect(fixture.nativeElement.textContent).toContain(
      'Warm Craftsman Near Downtown',
    );
  });

  it('should reload when the date range changes', () => {
    component.changeRange({
      target: { value: '90' },
    } as unknown as Event);

    expect(component.selectedDays).toBe(90);
    expect(service.getOverview).toHaveBeenCalledWith(90);
  });

  it('should export the currently selected analytics range', () => {
    component.selectedDays = 90;

    component.exportCsv();

    expect(exportService.exportAnalytics).toHaveBeenCalledWith(90);
    expect(exportService.saveCsv).toHaveBeenCalledWith(
      jasmine.any(Blob),
      'analytics-90-days.csv',
    );
  });

  it('should label the response granularity clearly', () => {
    expect(component.granularityLabel()).toBe('Daily');
  });
});
