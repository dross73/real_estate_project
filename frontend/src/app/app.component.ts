import { DOCUMENT, ViewportScroller } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { filter } from 'rxjs/operators';

import { SeoService } from './services/seo.service';
import { PrivacyConsentService } from './services/privacy-consent.service';
import { SiteSettingsService } from './services/site-settings.service';
import { SiteSettings } from './models/site-settings';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatButtonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly document = inject(DOCUMENT);
  private readonly privacyConsent = inject(PrivacyConsentService);
  private readonly siteSettings = inject(SiteSettingsService);
  private analyticsSettings: SiteSettings | null = null;
  private analyticsStarted = false;

  private previousPath = '';

  ngOnInit(): void {
    this.previousPath = this.router.url.split('?')[0].split('#')[0] || '/';

    this.applyRouteBaseline(this.router.url);

    // Analytics is optional and must honor the site's existing consent settings.
    this.siteSettings.getPublicSettings().subscribe({
      next: (settings) => {
        this.analyticsSettings = settings;
        this.enableAnalyticsIfAllowed();
      },
      error: () => undefined, // Fail closed if consent configuration is unavailable.
    });
    this.privacyConsent.preferencesChanged$.subscribe(() => {
      // Once loaded, the third-party beacon cannot be reliably unloaded.
      // Reload after consent withdrawal to stop subsequent route tracking.
      if (
        this.analyticsStarted &&
        this.analyticsSettings &&
        !this.privacyConsent.allowsAnalytics(this.analyticsSettings)
      ) {
        this.document.defaultView?.location.reload();
        return;
      }

      this.enableAnalyticsIfAllowed();
    });

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const navigation = event as NavigationEnd;
        const newPath =
          navigation.urlAfterRedirects.split('?')[0].split('#')[0] || '/';
        // Only reset scroll when navigating to a different page path.
        // Query-parameter changes such as sorting or filtering should keep the user's position.
        if (newPath !== this.previousPath) {
          this.viewportScroller.scrollToPosition([0, 0]);
        }

        this.previousPath = newPath;

        this.applyRouteBaseline(navigation.urlAfterRedirects);
      });
  }

  private enableAnalyticsIfAllowed(): void {
    const settings = this.analyticsSettings;
    if (
      this.document.location?.hostname !== 'realestate.dan-ross.dev' ||
      !settings ||
      !this.privacyConsent.allowsAnalytics(settings) ||
      this.document.getElementById('cloudflare-web-analytics')
    ) {
      return;
    }

    // Cloudflare's beacon observes History API navigation, including Angular routes.
    const script = this.document.createElement('script');
    script.id = 'cloudflare-web-analytics';
    script.type = 'module';
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.setAttribute('data-cf-beacon', JSON.stringify({
      token: '95c82bc7e6bb400ab5c285f27db5f11a',
      spa: true,
    }));
    this.document.head.appendChild(script);
    this.analyticsStarted = true;
  }

  private applyRouteBaseline(url: string): void {
    const path = url.split('?')[0].split('#')[0] || '/';

    // Private, preview, and internal application routes should never inherit
    // indexable metadata from the previous public SPA route.
    if (
      path.startsWith('/admin') ||
      path.startsWith('/account') ||
      path.startsWith('/preview')
    ) {
      this.seo.setNoIndex('Private Application', path);
      return;
    }

    // Dynamic records begin noindex and become indexable only after their
    // public API successfully returns an eligible record.
    if (/^\/listings\/\d+$/.test(path) || /^\/agents\/\d+$/.test(path)) {
      this.seo.setNoIndex('Loading Public Page', path);
      return;
    }

    const defaults: Record<string, { title: string; description: string }> = {
      '/': {
        title: 'Local Real Estate and Homes',
        description:
          'Explore local homes, property listings, and real estate guidance from Juniper & Lane Realty.',
      },
      '/listings': {
        title: 'Homes for Sale',
        description:
          'Browse current homes and real estate listings with practical filters for location, price, property type, and more.',
      },
      '/about': {
        title: 'About',
        description:
          'Learn about the local people, experience, and community-focused approach behind Juniper & Lane Realty.',
      },
      '/contact': {
        title: 'Contact',
        description:
          'Contact Juniper & Lane Realty for local real estate questions, listing information, and showing requests.',
      },
      '/privacy': {
        title: 'Privacy Policy',
        description: 'Read the privacy policy for this real estate website.',
      },
      '/terms': {
        title: 'Terms of Use',
        description: 'Read the terms of use for this real estate website.',
      },
    };

    const page = defaults[path];
    if (page) {
      this.seo.setPage({
        ...page,
        path,
      });
      return;
    }

    this.seo.setNoIndex('Page', path);
  }
}
