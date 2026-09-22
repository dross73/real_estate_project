import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SiteSettingsService } from './site-settings.service';

describe('SiteSettingsService', () => {
  let service: SiteSettingsService;
  let httpController: HttpTestingController;

  const settings = {
    site_name: 'Juniper & Lane',
    site_descriptor: 'Realty',
    tagline: 'A brighter tomorrow belongs here.',
    logo_url: null,
    phone: null,
    email: null,
    address_line1: null,
    city: null,
    state: null,
    postal_code: null,
    homepage_eyebrow: null,
    homepage_title: null,
    homepage_intro: null,
    homepage_story_title: null,
    homepage_story_copy: null,
    primary_color: '#13382b',
    secondary_color: '#738c78',
    show_about: true,
    show_contact: true,
    show_testimonials: false,
    enable_contact_requests: true,
    enable_showing_requests: true,
    listing_photo_max_count: 50,
    hard_listing_photo_max_count: 50,
    updated_at: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(SiteSettingsService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should share one public settings request across subscribers', () => {
    service.getPublicSettings().subscribe();
    service.getPublicSettings().subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/public/site-settings',
    );
    expect(request.request.method).toBe('GET');
    request.flush(settings);
  });

  it('should read and update admin settings', () => {
    service.getAdminSettings().subscribe();

    const read = httpController.expectOne(
      'http://localhost:8000/site-settings',
    );
    expect(read.request.method).toBe('GET');
    read.flush(settings);

    const {
      hard_listing_photo_max_count: _hardLimit,
      updated_at: _updatedAt,
      ...payload
    } = settings;

    service.updateAdminSettings(payload).subscribe();

    const update = httpController.expectOne(
      'http://localhost:8000/site-settings',
    );
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(payload);
    update.flush(settings);
  });
});
