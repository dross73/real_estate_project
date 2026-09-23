import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { SiteSettings } from '../models/site-settings';

export interface SeoPageConfig {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
  type?: 'website' | 'article';
  robots?: 'index,follow' | 'noindex,nofollow';
  appendSiteName?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly titleService = inject(Title);

  private siteName = 'Juniper & Lane Realty';
  private currentConfig: SeoPageConfig | null = null;

  setSiteIdentity(settings: SiteSettings): void {
    const name = settings.site_name?.trim() || 'Juniper & Lane';
    const descriptor = settings.site_descriptor?.trim() || '';
    this.siteName = descriptor ? `${name} ${descriptor}` : name;

    // Re-render the active page so late-loaded site settings update its title.
    if (this.currentConfig) {
      this.render(this.currentConfig);
    }
  }

  setPage(config: SeoPageConfig): void {
    this.currentConfig = config;
    this.render(config);
  }

  setNoIndex(title: string, path?: string): void {
    this.setPage({
      title,
      description: 'This page is not intended for search engine indexing.',
      path,
      robots: 'noindex,nofollow',
    });
  }

  canonicalUrl(path?: string): string {
    const rawPath = path ?? this.document.location?.pathname ?? '/';
    const normalizedPath = rawPath.split('?')[0].split('#')[0] || '/';
    const origin = this.document.location?.origin || this.document.baseURI;
    return new URL(normalizedPath, origin).toString();
  }

  private render(config: SeoPageConfig): void {
    const appendSiteName = config.appendSiteName !== false;
    const pageTitle = config.title.trim();
    const fullTitle =
      appendSiteName && pageTitle !== this.siteName
        ? `${pageTitle} | ${this.siteName}`
        : pageTitle;

    const description = this.cleanDescription(config.description);
    const canonical = this.canonicalUrl(config.path);
    const robots = config.robots ?? 'index,follow';
    const type = config.type ?? 'website';

    this.titleService.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: robots });

    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });

    this.meta.updateTag({
      name: 'twitter:card',
      content: config.image ? 'summary_large_image' : 'summary',
    });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    if (config.image) {
      this.meta.updateTag({ property: 'og:image', content: config.image });
      this.meta.updateTag({ name: 'twitter:image', content: config.image });
    } else {
      this.removeMeta('property', 'og:image');
      this.removeMeta('name', 'twitter:image');
    }

    this.setCanonicalLink(canonical);
    this.setStructuredData(config.structuredData ?? null);
  }

  private cleanDescription(value: string): string {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 160) {
      return cleaned;
    }
    return `${cleaned.slice(0, 157).trimEnd()}...`;
  }

  private setCanonicalLink(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }

    link.href = url;
  }

  private setStructuredData(
    data: Record<string, unknown> | Array<Record<string, unknown>> | null,
  ): void {
    const existing = this.document.getElementById('app-seo-jsonld');
    existing?.remove();

    if (!data) {
      return;
    }

    const script = this.document.createElement('script');
    script.id = 'app-seo-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    this.document.head.appendChild(script);
  }

  private removeMeta(attribute: 'name' | 'property', value: string): void {
    this.meta.removeTag(`${attribute}="${value}"`);
  }
}
