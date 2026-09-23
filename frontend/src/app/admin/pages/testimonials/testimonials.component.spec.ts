import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Testimonial } from '../../../models/testimonial';
import { TestimonialService } from '../../../services/testimonial.service';
import { TestimonialsComponent } from './testimonials.component';

describe('TestimonialsComponent', () => {
  let fixture: ComponentFixture<TestimonialsComponent>;
  let component: TestimonialsComponent;
  let service: jasmine.SpyObj<TestimonialService>;

  const pending: Testimonial = {
    id: 7,
    author_user_id: 9,
    author_name: 'Buyer Person',
    body: 'The team communicated clearly throughout the process.',
    rating: 5,
    source: 'public',
    status: 'Pending',
    moderated_by_email: null,
    moderated_at: null,
    created_at: '2026-09-22T23:00:00Z',
    updated_at: '2026-09-22T23:00:00Z',
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<TestimonialService>('TestimonialService', [
      'getTestimonials',
      'updateTestimonial',
      'deleteTestimonial',
    ]);

    service.getTestimonials.and.returnValue(of([pending]));
    service.updateTestimonial.and.returnValue(
      of({
        ...pending,
        status: 'Approved',
        moderated_by_email: 'staff@example.com',
        moderated_at: '2026-09-23T00:00:00Z',
      }),
    );
    service.deleteTestimonial.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [TestimonialsComponent],
      providers: [
        provideRouter([]),
        { provide: TestimonialService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestimonialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load testimonials for moderation', () => {
    expect(service.getTestimonials).toHaveBeenCalledWith({});
    expect(component.isLoading).toBeFalse();
    expect(component.testimonials).toEqual([pending]);
  });

  it('should approve a pending testimonial in place', () => {
    component.setStatus(pending, 'Approved');

    expect(service.updateTestimonial).toHaveBeenCalledWith(7, {
      status: 'Approved',
    });
    expect(component.testimonials[0].status).toBe('Approved');
  });

  it('should remove a testimonial after confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(true);

    component.deleteTestimonial(pending);

    expect(service.deleteTestimonial).toHaveBeenCalledWith(7);
    expect(component.testimonials).toEqual([]);
  });
});
