import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SeoService } from '../../../services/seo.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { COUNTY_MARKET_REPORTS } from '../../data/market-report';

@Component({
  selector: 'app-market-report',
  imports: [RouterLink],
  templateUrl: './market-report.component.html',
  styleUrl: './market-report.component.css',
})
export class MarketReportComponent implements OnInit {
  readonly reports = COUNTY_MARKET_REPORTS;
  showContact = false;
  siteName = 'Juniper & Lane';
  private readonly settingsService = inject(SiteSettingsService);
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Central Iowa Market Report',
      description: 'Story County and Polk County housing snapshots with median sold prices, days on market, and sale-to-list ratios from Realtor.com Economic Research.',
      path: '/market-report',
    });
    this.settingsService.getPublicSettings().subscribe({
      next: settings => {
        this.showContact = settings.show_contact;
        this.siteName = settings.site_name || this.siteName;
      },
      // The sourced snapshots remain available if optional contact settings fail.
      error: () => undefined,
    });
  }
}
