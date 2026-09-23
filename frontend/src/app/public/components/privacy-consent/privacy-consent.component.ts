import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SiteSettings } from '../../../models/site-settings';
import { PrivacyConsentService } from '../../../services/privacy-consent.service';
import { SiteSettingsService } from '../../../services/site-settings.service';

@Component({
  selector: 'app-privacy-consent',
  imports: [RouterLink],
  templateUrl: './privacy-consent.component.html',
  styleUrl: './privacy-consent.component.css',
})
export class PrivacyConsentComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingsService = inject(SiteSettingsService);
  private readonly consentService = inject(PrivacyConsentService);

  settings: SiteSettings | null = null;
  showBanner = false;
  showPanel = false;
  analyticsChoice = false;
  marketingChoice = false;

  ngOnInit(): void {
    this.consentService.openPreferences$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.openPreferences());

    this.settingsService.getPublicSettings().subscribe({
      next: (settings) => {
        this.settings = settings;

        const stored = this.consentService.getPreferences();
        this.analyticsChoice = stored?.analytics ?? false;
        this.marketingChoice = stored?.marketing ?? false;
        this.showBanner =
          this.consentService.isConsentUiNeeded(settings) && stored === null;
      },
      // Privacy controls stay out of the way if settings cannot load.
      error: () => undefined,
    });
  }

  get analyticsEnabled(): boolean {
    return this.settings?.privacy_analytics_category_enabled ?? false;
  }

  get marketingEnabled(): boolean {
    return this.settings?.privacy_marketing_category_enabled ?? false;
  }

  get showPrivacyLink(): boolean {
    return this.settings?.show_privacy ?? false;
  }

  acceptOptional(): void {
    this.save(
      this.analyticsEnabled,
      this.marketingEnabled,
    );
  }

  rejectOptional(): void {
    this.save(false, false);
  }

  openPreferences(): void {
    if (
      !this.settings ||
      !this.consentService.isConsentUiNeeded(this.settings)
    ) {
      return;
    }

    const stored = this.consentService.getPreferences();
    this.analyticsChoice = stored?.analytics ?? false;
    this.marketingChoice = stored?.marketing ?? false;
    this.showPanel = true;
  }

  saveCustomPreferences(): void {
    this.save(
      this.analyticsEnabled && this.analyticsChoice,
      this.marketingEnabled && this.marketingChoice,
    );
  }

  closePreferences(): void {
    this.showPanel = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePreferences();
  }

  private save(analytics: boolean, marketing: boolean): void {
    this.consentService.savePreferences(analytics, marketing);
    this.analyticsChoice = analytics;
    this.marketingChoice = marketing;
    this.showBanner = false;
    this.showPanel = false;
  }
}
