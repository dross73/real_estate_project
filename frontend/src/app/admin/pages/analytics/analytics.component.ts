import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import {
  AnalyticsOverview,
  AnalyticsSourceCategory,
} from '../../../models/analytics';
import { AnalyticsService } from '../../../services/analytics.service';
import { ExportService } from '../../../services/export.service';

@Component({
  selector: 'app-analytics',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AnalyticsComponent implements OnInit {
  readonly rangeOptions = [
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: 90, label: 'Last 90 days' },
    { days: 365, label: 'Last 12 months' },
  ];

  selectedDays = 30;
  overview: AnalyticsOverview | null = null;
  isLoading = true;
  loadError = '';
  isExporting = false;
  exportError = '';

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly exportService: ExportService,
  ) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  changeRange(event: Event): void {
    const days = Number((event.target as HTMLSelectElement).value);
    if (!Number.isInteger(days) || days <= 0 || days === this.selectedDays) {
      return;
    }

    this.selectedDays = days;
    this.loadOverview();
  }

  exportCsv(): void {
    if (this.isExporting) {
      return;
    }

    this.isExporting = true;
    this.exportError = '';

    this.exportService
      .exportAnalytics(this.selectedDays)
      .pipe(finalize(() => (this.isExporting = false)))
      .subscribe({
        next: (blob) => {
          this.exportService.saveCsv(
            blob,
            `analytics-${this.selectedDays}-days.csv`,
          );
        },
        error: () => {
          this.exportError =
            'Unable to export analytics right now. Please try again.';
        },
      });
  }

  sourceLabel(category: AnalyticsSourceCategory): string {
    const labels: Record<AnalyticsSourceCategory, string> = {
      direct: 'Direct',
      search: 'Search',
      social: 'Social',
      referral: 'Referring site',
    };
    return labels[category];
  }

  granularityLabel(): string {
    if (!this.overview) {
      return '';
    }

    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
    };
    return labels[this.overview.granularity];
  }

  private loadOverview(): void {
    this.isLoading = true;
    this.loadError = '';

    this.analyticsService
      .getOverview(this.selectedDays)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (overview) => {
          this.overview = overview;
        },
        error: () => {
          this.overview = null;
          this.loadError =
            'Unable to load analytics right now. Please try again later.';
        },
      });
  }
}
