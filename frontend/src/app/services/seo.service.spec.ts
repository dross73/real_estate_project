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

  it('should emit live listing Open Graph and RealEstateListing JSON-LD', () => {
    service.setListing(
      {
        id: 27,
        title: 'Warm Craftsman',
        status: 'Active',
        is_featured: false,
        hide_exact_address: false,
        price: 425000,
        property_type: 'Single Family',
        address: '123 Main St',
        city: 'Ames',
        state: 'IA',
        description: 'A warm craftsman near downtown.',
        sqft: 1800,
        acreage: null,
        year_built: 1920,
        bedrooms: 3,
        bathrooms: 2,
        annual_property_taxes: null,
        hoa_fee: null,
        hoa_fee_frequency: null,
        school_district: null,
        amenities: [],
        mls_number: null,
        source_attribution: null,
        cover_image: 'https://images.example.com/27.webp',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      },
      {
        site_name: 'Juniper & Lane',
        site_descriptor: 'Realty',
      } as any,
    );

    expect(meta.getTag('property="og:type"')?.content).toBe('article');
    expect(meta.getTag('property="og:image"')?.content).toContain('27.webp');

    const jsonLd = JSON.parse(
      document.getElementById('app-seo-jsonld')?.textContent || '{}',
    );
    expect(jsonLd['@type']).toBe('RealEstateListing');
    expect(jsonLd.offers.price).toBe(425000);
    expect(jsonLd.about.address.streetAddress).toBe('123 Main St');
  });

  it('should omit a hidden street address when public listing data omits it', () => {
    service.setListing({
      id: 28,
      title: 'Private Address Home',
      status: 'Active',
      is_featured: false,
      hide_exact_address: true,
      price: 300000,
      property_type: 'Single Family',
      address: null,
      city: 'Ames',
      state: 'IA',
      description: null,
      sqft: null,
      acreage: null,
      year_built: null,
      bedrooms: 2,
      bathrooms: 1,
      annual_property_taxes: null,
      hoa_fee: null,
      hoa_fee_frequency: null,
      school_district: null,
      amenities: [],
      mls_number: null,
      source_attribution: null,
      cover_image: null,
      created_at: null,
      updated_at: null,
    });

    const jsonLd = JSON.parse(
      document.getElementById('app-seo-jsonld')?.textContent || '{}',
    );
    expect(jsonLd.about.address.streetAddress).toBeUndefined();
    expect(jsonLd.about.address.addressLocality).toBe('Ames');
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
