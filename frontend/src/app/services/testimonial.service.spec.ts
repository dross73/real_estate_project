import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TestimonialService } from './testimonial.service';

describe('TestimonialService', () => {
  let service: TestimonialService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(TestimonialService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should load filtered testimonials for moderation', () => {
    service
      .getTestimonials({ status: 'Pending', source: 'public' })
      .subscribe();

    const request = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/testimonials' &&
        candidate.params.get('status') === 'Pending' &&
        candidate.params.get('source') === 'public',
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('should create update and delete testimonials', () => {
    service
      .createTestimonial({
        author_name: 'Alex Customer',
        body: 'A clear and helpful real estate experience.',
        rating: 5,
        status: 'Approved',
      })
      .subscribe();

    const create = httpController.expectOne(
      'http://localhost:8000/testimonials',
    );
    expect(create.request.method).toBe('POST');
    expect(create.request.body.status).toBe('Approved');
    create.flush({
      id: 1,
      author_user_id: null,
      author_name: 'Alex Customer',
      body: 'A clear and helpful real estate experience.',
      rating: 5,
      source: 'internal',
      status: 'Approved',
      moderated_by_email: 'admin@example.com',
      moderated_at: '2026-09-22T23:00:00Z',
      created_at: '2026-09-22T23:00:00Z',
      updated_at: '2026-09-22T23:00:00Z',
    });

    service.updateTestimonial(1, { status: 'Rejected' }).subscribe();

    const update = httpController.expectOne(
      'http://localhost:8000/testimonials/1',
    );
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ status: 'Rejected' });
    update.flush({});

    service.deleteTestimonial(1).subscribe();

    const remove = httpController.expectOne(
      'http://localhost:8000/testimonials/1',
    );
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('should load approved public testimonials and submit public feedback', () => {
    service.getPublicTestimonials(3).subscribe();

    const list = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/public/testimonials' &&
        candidate.params.get('limit') === '3',
    );
    expect(list.request.method).toBe('GET');
    list.flush([]);

    service
      .submitPublicTestimonial({
        body: 'The communication was excellent from start to finish.',
        rating: 5,
      })
      .subscribe();

    const submit = httpController.expectOne(
      'http://localhost:8000/public/testimonials',
    );
    expect(submit.request.method).toBe('POST');
    expect(submit.request.body).toEqual({
      body: 'The communication was excellent from start to finish.',
      rating: 5,
    });
    submit.flush({});
  });
});
