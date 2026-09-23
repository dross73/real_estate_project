import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SiteSettingsService } from '../../../services/site-settings.service';
import { TestimonialService } from '../../../services/testimonial.service';
import { TestimonialSubmitComponent } from './testimonial-submit.component';

describe('TestimonialSubmitComponent', () => {
  let fixture: ComponentFixture<TestimonialSubmitComponent>;
  let component: TestimonialSubmitComponent;
  let settingsService: jasmine.SpyObj<SiteSettingsService>;
  let testimonialService: jasmine.SpyObj<TestimonialService>;

  const settings = {
    site_name: 'Juniper & Lane',
    site_descriptor: 'Realty',
    tagline: 'A brighter tomorrow belongs here.',
    logo_url: null,
    phone: null,
    email: null,
    address_line1: null,
    city: 'Ames',
    state: 'IA',
    postal_code: '50010',
    homepage_eyebrow: null,
    homepage_title: null,
    homepage_intro: null,
    homepage_story_title: null,
    homepage_story_copy: null,
    primary_color: '#13382b',
    secondary_color: '#738c78',
    show_about: true,
    show_contact: true,
    show_testimonials: true,
    enable_testimonial_submissions: true,
    enable_contact_requests: true,
    enable_showing_requests: true,
    listing_photo_max_count: 50,
    hard_listing_photo_max_count: 50,
    updated_at: null,
  };

  beforeEach(async () => {
    settingsService = jasmine.createSpyObj<SiteSettingsService>(
      'SiteSettingsService',
      ['getPublicSettings'],
    );
    settingsService.getPublicSettings.and.returnValue(of(settings));

    testimonialService = jasmine.createSpyObj<TestimonialService>(
      'TestimonialService',
      ['submitPublicTestimonial'],
    );
    testimonialService.submitPublicTestimonial.and.returnValue(
      of({
        id: 12,
        author_user_id: 9,
        author_name: 'Buyer Person',
        body: 'The communication was excellent from start to finish.',
        rating: 5,
        source: 'public',
        status: 'Pending',
        moderated_by_email: null,
        moderated_at: null,
        created_at: '2026-09-22T23:00:00Z',
        updated_at: '2026-09-22T23:00:00Z',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [TestimonialSubmitComponent],
      providers: [
        provideRouter([]),
        { provide: SiteSettingsService, useValue: settingsService },
        { provide: TestimonialService, useValue: testimonialService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestimonialSubmitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load whether public testimonial submissions are enabled', () => {
    expect(component.isLoading).toBeFalse();
    expect(component.submissionsEnabled).toBeTrue();
  });

  it('should submit valid feedback once and show the success state', () => {
    component.form.setValue({
      body: 'The communication was excellent from start to finish.',
      rating: 5,
    });

    component.submit();
    component.submit();

    expect(testimonialService.submitPublicTestimonial).toHaveBeenCalledTimes(1);
    expect(testimonialService.submitPublicTestimonial).toHaveBeenCalledWith({
      body: 'The communication was excellent from start to finish.',
      rating: 5,
    });
    expect(component.submitted).toBeTrue();
  });

  it('should not submit while public testimonial submissions are disabled', () => {
    component.submissionsEnabled = false;
    component.form.setValue({
      body: 'The communication was excellent from start to finish.',
      rating: 5,
    });

    component.submit();

    expect(testimonialService.submitPublicTestimonial).not.toHaveBeenCalled();
  });
});
