import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SiteSettings } from '../../../models/site-settings';
import { SeoService } from '../../../services/seo.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { MarketReportComponent } from './market-report.component';

describe('MarketReportComponent', () => {
  let fixture: ComponentFixture<MarketReportComponent>;
  let settingsService: jasmine.SpyObj<SiteSettingsService>;
  let seo: jasmine.SpyObj<SeoService>;

  beforeEach(async () => {
    settingsService = jasmine.createSpyObj('SiteSettingsService', ['getPublicSettings']);
    settingsService.getPublicSettings.and.returnValue(of({ show_contact: true, site_name: 'Juniper & Lane' } as SiteSettings));
    seo = jasmine.createSpyObj('SeoService', ['setPage']);
    await TestBed.configureTestingModule({
      imports: [MarketReportComponent],
      providers: [
        provideRouter([]),
        { provide: SiteSettingsService, useValue: settingsService },
        { provide: SeoService, useValue: seo },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MarketReportComponent);
  });

  for (const [id, title, period, dateTime, values] of [
    ['story-county', 'Story County', 'September 2026', '2026-09', ['$322,500', '47', '99%']],
    ['polk-county', 'Polk County / Ankeny', 'September 2026', '2026-09', ['$299,999', '59', '99%']],
  ] as const) {
    it(`should render the dated ${title} metrics and source attribution`, () => {
      fixture.detectChanges();
      const section = fixture.nativeElement.querySelector(`[aria-labelledby="${id}-title"]`) as HTMLElement;
      expect(section.querySelector('h2')?.textContent).toBe(title);
      expect(section.querySelector('time')?.textContent).toBe(period);
      expect(section.querySelector('time')?.getAttribute('datetime')).toBe(dateTime);
      expect(Array.from(section.querySelectorAll('.report-metric dd')).map(el => el.textContent)).toEqual([...values]);
      expect(Array.from(section.querySelectorAll('.report-metric dt')).map(el => el.textContent))
        .toEqual(['Median sold price', 'Median days on market', 'Sale-to-list ratio']);
      expect(section.textContent).toContain('Realtor.com Economic Research');
      expect(section.querySelector('a')?.href).toBe(`https://www.realtor.com/local/market/iowa/${id}`);
    });
  }

  it('should explain the countywide scope and link back to listings and enabled contact', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('not a month-to-month comparison');
    expect(fixture.nativeElement.textContent).toContain('source reports may have newer releases');
    expect(fixture.nativeElement.querySelector('a[href="/listings"]')?.textContent).toBe('Browse Listings');
    expect(fixture.nativeElement.querySelector('a[href="/contact"]')?.textContent).toContain('Contact Juniper & Lane');
  });

  it('should keep the report accessible when contact is disabled', () => {
    settingsService.getPublicSettings.and.returnValue(of({ show_contact: false } as SiteSettings));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.county-report').length).toBe(2);
    expect(fixture.nativeElement.querySelector('a[href="/contact"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/listings"]')).not.toBeNull();
  });

  it('should render static report data even when site settings fail', () => {
    settingsService.getPublicSettings.and.returnValue(throwError(() => new Error('offline')));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.county-report').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('$322,500');
    expect(fixture.nativeElement.textContent).toContain('$299,999');
    expect(fixture.nativeElement.querySelector('a[href="/contact"]')).toBeNull();
  });

  it('should set market-report metadata instead of retaining the previous page metadata', () => {
    fixture.detectChanges();
    expect(seo.setPage).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      title: 'Central Iowa Market Report',
      path: '/market-report',
    }));
  });
});
