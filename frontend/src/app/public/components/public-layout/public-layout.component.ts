import { Component, ElementRef, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteSettingsService } from '../../../services/site-settings.service';

import { PublicFooterComponent } from '../public-footer/public-footer.component';
import { PublicHeaderComponent } from '../public-header/public-header.component';
import { PrivacyConsentComponent } from '../privacy-consent/privacy-consent.component';

@Component({
  selector: 'app-public-layout',
  imports: [
    RouterOutlet,
    PublicHeaderComponent,
    PublicFooterComponent,
    PrivacyConsentComponent,
  ],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.css',
})
export class PublicLayoutComponent implements OnInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly siteSettingsService = inject(SiteSettingsService);

  ngOnInit(): void {
    this.siteSettingsService.getPublicSettings().subscribe({
      next: (settings) => {
        const host = this.elementRef.nativeElement;
        host.style.setProperty('--public-color-forest', settings.primary_color);
        host.style.setProperty('--public-color-sage', settings.secondary_color);
      },
      // Root CSS variables remain the graceful fallback.
      error: () => undefined,
    });
  }
}
