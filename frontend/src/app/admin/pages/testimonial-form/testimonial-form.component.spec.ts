import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, throwError } from 'rxjs';

import { TestimonialService } from '../../../services/testimonial.service';
import { TestimonialFormComponent } from './testimonial-form.component';

describe('TestimonialFormComponent', () => {
  let fixture: ComponentFixture<TestimonialFormComponent>;
  let component: TestimonialFormComponent;
  let testimonialService: jasmine.SpyObj<TestimonialService>;
  let router: Router;

  beforeEach(async () => {
    testimonialService = jasmine.createSpyObj<TestimonialService>(
      'TestimonialService',
      ['getTestimonial', 'createTestimonial', 'updateTestimonial'],
    );
    testimonialService.createTestimonial.and.returnValue(
      of({
        id: 1,
        author_user_id: null,
        author_name: 'Alex Customer',
        body: 'Thoughtful guidance from beginning to end.',
        rating: 5,
        source: 'internal',
        status: 'Approved',
        moderated_by_email: null,
        moderated_at: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [TestimonialFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
        { provide: TestimonialService, useValue: testimonialService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestimonialFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  it('should reject an invalid testimonial before calling the API', () => {
    component.save();

    expect(component.form.touched).toBeTrue();
    expect(testimonialService.createTestimonial).not.toHaveBeenCalled();
  });

  it('should trim content and create an approved testimonial', () => {
    component.form.setValue({
      authorName: '  Alex Customer  ',
      body: '  Thoughtful guidance from beginning to end.  ',
      rating: 5,
      status: 'Approved',
    });

    component.save();

    expect(testimonialService.createTestimonial).toHaveBeenCalledWith({
      author_name: 'Alex Customer',
      body: 'Thoughtful guidance from beginning to end.',
      rating: 5,
      status: 'Approved',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/testimonials']);
  });

  it('should expose a save failure and clear the saving state', () => {
    testimonialService.createTestimonial.and.returnValue(
      throwError(() => new Error('offline')),
    );
    component.form.setValue({
      authorName: 'Alex Customer',
      body: 'Thoughtful guidance from beginning to end.',
      rating: null,
      status: 'Pending',
    });

    component.save();

    expect(component.errorMessage).toBe('Unable to save the testimonial.');
    expect(component.isSaving).toBeFalse();
  });
});
