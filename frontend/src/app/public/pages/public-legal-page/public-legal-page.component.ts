import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SiteSettingsService } from '../../../services/site-settings.service';

type LegalPageType = 'privacy' | 'terms';

@Component({
  selector: 'app-public-legal-page',
  imports: [RouterLink],
  templateUrl: './public-legal-page.component.html',
  styleUrl: './public-legal-page.component.css',
})
export class PublicLegalPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly settingsService = inject(SiteSettingsService);

  pageType: LegalPageType = 'privacy';
  title = '';
  body = '';
  enabled = false;
  isLoading = true;
  loadError = '';

  ngOnInit(): void {
    this.pageType =
      this.route.snapshot.data['page'] === 'terms' ? 'terms' : 'privacy';

    this.settingsService.getPublicSettings().subscribe({
      next: (settings) => {
        if (this.pageType === 'terms') {
          this.enabled = settings.show_terms ?? false;
          this.title = settings.terms_title || 'Terms of Use';
          this.body = settings.terms_body || '';
        } else {
          this.enabled = settings.show_privacy ?? false;
          this.title = settings.privacy_title || 'Privacy Policy';
          this.body = settings.privacy_body || '';
        }
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'We couldn’t load this page right now.';
        this.isLoading = false;
      },
    });
  }
}
