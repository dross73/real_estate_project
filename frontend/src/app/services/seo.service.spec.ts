import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';

import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let document: Document;
  let title: Title;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);

    document.getElementById('app-seo-jsonld')?.remove();
    document.head
      .querySelectorAll('link[rel="canonical"]')
      .forEach((element) => element.remove());
  });

  it('should set title, description, canonical, and social metadata', () => {
    service.setPage({
      title: 'Homes for Sale',
      description: 'Browse current local homes for sale.',
      path: '/listings?sort=newest',
      image: 'https://images.example.com/home.webp',
    });

    expect(title.getTitle()).toContain('Homes for Sale');
    expect(meta.getTag('name="description"')?.content).toBe(
      'Browse current local homes for sale.',
    );
    expect(meta.getTag('property="og:title"')?.content).toContain(
      'Homes for Sale',
    );
    expect(meta.getTag('property="og:image"')?.content).toBe(
      'https://images.example.com/home.webp',
    );
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.href,
    ).not.toContain('?');
  });

  it('should mark private pages noindex and clear stale structured data', () => {
    service.setPage({
      title: 'Listing',
      description: 'Public listing',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
      },
    });
    expect(document.getElementById('app-seo-jsonld')).not.toBeNull();

    service.setNoIndex('Private Application', '/admin');

    expect(meta.getTag('name="robots"')?.content).toBe('noindex,nofollow');
    expect(document.getElementById('app-seo-jsonld')).toBeNull();
  });

  it('should refresh the active title when live site identity loads', () => {
    service.setPage({
      title: 'About',
      description: 'About the brokerage.',
      path: '/about',
    });

    service.setSiteIdentity({
      site_name: 'Prairie Homes',
      site_descriptor: 'Realty',
    } as any);

    expect(title.getTitle()).toBe('About | Prairie Homes Realty');
    expect(meta.getTag('property="og:site_name"')?.content).toBe(
      'Prairie Homes Realty',
    );
  });
});
