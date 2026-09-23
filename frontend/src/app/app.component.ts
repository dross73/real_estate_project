import { Component, inject, OnInit } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { filter } from 'rxjs/operators';

import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatButtonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.applyRouteBaseline(this.router.url);

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.applyRouteBaseline(
          (event as NavigationEnd).urlAfterRedirects,
        );
      });
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
    if (
      /^\/listings\/\d+$/.test(path) ||
      /^\/agents\/\d+$/.test(path)
    ) {
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
