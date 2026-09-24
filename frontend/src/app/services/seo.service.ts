
import { inject, Injectable, DOCUMENT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { PublicAgentProfile } from '../models/agent';
import { SiteSettings } from '../models/site-settings';
import { PublicListing } from '../public/models/public-listing';

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

  setHome(settings: SiteSettings): void {
    const description =
      settings.homepage_intro ||
      settings.tagline ||
      'Explore local homes and real estate guidance.';

    const canonical = this.canonicalUrl('/');
    const address = this.postalAddress(settings);

    this.setPage({
      title: settings.tagline || 'Local Real Estate and Homes',
      description,
      path: '/',
      appendSiteName: true,
      structuredData: this.compactObject({
        '@context': 'https://schema.org',
        '@type': 'RealEstateAgent',
        name: this.displaySiteName(settings),
        url: canonical,
        telephone: settings.phone,
        email: settings.email,
        address,
      }),
    });
  }

  setListing(
    listing: PublicListing,
    settings?: SiteSettings | null,
  ): void {
    const location = [listing.city, listing.state].filter(Boolean).join(', ');
    const facts = [
      `${listing.bedrooms} bed${listing.bedrooms === 1 ? '' : 's'}`,
      `${listing.bathrooms} bath${listing.bathrooms === 1 ? '' : 's'}`,
      listing.sqft ? `${listing.sqft.toLocaleString('en-US')} sq ft` : '',
    ].filter(Boolean);

    const description =
      listing.description ||
      `${listing.title} in ${location}. ${facts.join(', ')}. Listed at ${this.formatUsd(
        listing.price,
      )}.`;

    const path = `/listings/${listing.id}`;
    const canonical = this.canonicalUrl(path);
    const address = this.compactObject({
      '@type': 'PostalAddress',
      streetAddress: listing.address,
      addressLocality: listing.city,
      addressRegion: listing.state,
      addressCountry: 'US',
    });

    const property = this.compactObject({
      '@type':
        listing.property_type === 'Single Family'
          ? 'SingleFamilyResidence'
          : 'Place',
      name: listing.title,
      address,
    });

    const offer = this.compactObject({
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: 'USD',
      url: canonical,
      businessFunction: 'https://purl.org/goodrelations/v1#Sell',
      availability: this.availabilityForStatus(listing.status),
      seller: settings
        ? this.compactObject({
            '@type': 'RealEstateAgent',
            name: this.displaySiteName(settings),
            url: this.canonicalUrl('/'),
          })
        : null,
    });

    this.setPage({
      title: `${listing.title} - ${location}`,
      description,
      path,
      image: listing.cover_image,
      type: 'article',
      structuredData: this.compactObject({
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: listing.title,
        description: this.cleanDescription(description),
        url: canonical,
        image: listing.cover_image,
        datePosted: listing.created_at,
        dateModified: listing.updated_at,
        about: property,
        offers: offer,
      }),
    });
  }

  setAgent(agent: PublicAgentProfile): void {
    const description =
      agent.bio ||
      `View listings and contact information for ${agent.full_name}.`;

    const path = `/agents/${agent.id}`;

    this.setPage({
      title: agent.full_name,
      description,
      path,
      image: agent.photo_url,
      structuredData: this.compactObject({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: agent.full_name,
        jobTitle: agent.professional_title || 'Real Estate Agent',
        description: agent.bio,
        email: agent.email,
        telephone: agent.phone,
        image: agent.photo_url,
        url: this.canonicalUrl(path),
        worksFor: agent.office_name
          ? {
              '@type': 'Organization',
              name: agent.office_name,
            }
          : null,
      }),
    });
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

  private displaySiteName(settings: SiteSettings): string {
    const name = settings.site_name?.trim() || 'Juniper & Lane';
    const descriptor = settings.site_descriptor?.trim() || '';
    return descriptor ? `${name} ${descriptor}` : name;
  }

  private postalAddress(
    settings: SiteSettings,
  ): Record<string, unknown> | null {
    if (
      !settings.address_line1 &&
      !settings.city &&
      !settings.state &&
      !settings.postal_code
    ) {
      return null;
    }

    return this.compactObject({
      '@type': 'PostalAddress',
      streetAddress: settings.address_line1,
      addressLocality: settings.city,
      addressRegion: settings.state,
      postalCode: settings.postal_code,
      addressCountry: 'US',
    });
  }

  private availabilityForStatus(status: PublicListing['status']): string {
    if (status === 'Sold') {
      return 'https://schema.org/SoldOut';
    }
    if (status === 'Pending') {
      return 'https://schema.org/LimitedAvailability';
    }
    return 'https://schema.org/InStock';
  }

  private formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private compactObject(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, item]) =>
          item !== null &&
          item !== undefined &&
          item !== '',
      ),
    );
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
