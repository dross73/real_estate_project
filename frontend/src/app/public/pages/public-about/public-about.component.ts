import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SiteSettings } from '../../../models/site-settings';
import { SiteSettingsService } from '../../../services/site-settings.service';

@Component({
  selector: 'app-public-about',
  imports: [RouterLink],
  templateUrl: './public-about.component.html',
  styleUrl: './public-about.component.css',
})
export class PublicAboutComponent implements OnInit {
  private readonly settingsService = inject(SiteSettingsService);

  settings: SiteSettings | null = null;
  isLoading = true;
  loadError = '';

  ngOnInit(): void {
    this.settingsService.getPublicSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'We couldn’t load the About page right now.';
        this.isLoading = false;
      },
    });
  }

  get pageVisible(): boolean {
    return Boolean(this.settings?.show_about);
  }
}
