import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  TestimonialCreate,
  TestimonialStatus,
} from '../../../models/testimonial';
import { TestimonialService } from '../../../services/testimonial.service';

@Component({
  selector: 'app-testimonial-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './testimonial-form.component.html',
  styleUrl: './testimonial-form.component.css',
})
export class TestimonialFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly testimonialService = inject(TestimonialService);

  readonly statuses: TestimonialStatus[] = [
    'Pending',
    'Approved',
    'Rejected',
  ];

  testimonialId: number | null = null;
  isLoading = false;
  isSaving = false;
  errorMessage = '';

  readonly form = this.formBuilder.group({
    authorName: ['', [Validators.required, Validators.maxLength(120)]],
    body: [
      '',
      [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(3000),
      ],
    ],
    rating: this.formBuilder.control<number | null>(null, [
      Validators.min(1),
      Validators.max(5),
    ]),
    status: this.formBuilder.nonNullable.control<TestimonialStatus>('Approved'),
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (Number.isInteger(id) && id > 0) {
      this.testimonialId = id;
      this.isLoading = true;

      this.testimonialService
        .getTestimonial(id)
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: (testimonial) => {
            this.form.setValue({
              authorName: testimonial.author_name,
              body: testimonial.body,
              rating: testimonial.rating,
              status: testimonial.status,
            });
          },
          error: () => {
            this.errorMessage = 'Unable to load this testimonial.';
          },
        });
    }
  }

  save(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: TestimonialCreate = {
      author_name: value.authorName!.trim(),
      body: value.body!.trim(),
      rating: value.rating,
      status: value.status,
    };

    this.isSaving = true;
    this.errorMessage = '';

    const request = this.testimonialId
      ? this.testimonialService.updateTestimonial(this.testimonialId, payload)
      : this.testimonialService.createTestimonial(payload);

    request
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => void this.router.navigate(['/admin/testimonials']),
        error: () => {
          this.errorMessage = 'Unable to save the testimonial.';
        },
      });
  }

  cancel(): void {
    void this.router.navigate(['/admin/testimonials']);
  }
}
