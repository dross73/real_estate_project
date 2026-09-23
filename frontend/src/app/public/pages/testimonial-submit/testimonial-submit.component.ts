import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { SiteSettingsService } from '../../../services/site-settings.service';
import { TestimonialService } from '../../../services/testimonial.service';

@Component({
  selector: 'app-testimonial-submit',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './testimonial-submit.component.html',
  styleUrl: './testimonial-submit.component.css',
})
export class TestimonialSubmitComponent implements OnInit {
  isLoading = true;
  submissionsEnabled = false;
  isSubmitting = false;
  submitted = false;
  errorMessage = '';

  readonly form;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly testimonialService: TestimonialService,
  ) {
    this.form = this.formBuilder.group({
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
    });
  }

  ngOnInit(): void {
    this.siteSettingsService
      .getPublicSettings()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (settings) => {
          this.submissionsEnabled = settings.enable_testimonial_submissions;
        },
        error: () => {
          this.errorMessage =
            'Unable to load testimonial submission settings.';
        },
      });
  }

  submit(): void {
    if (
      !this.submissionsEnabled ||
      this.form.invalid ||
      this.isSubmitting ||
      this.submitted
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.isSubmitting = true;
    this.errorMessage = '';

    this.testimonialService
      .submitPublicTestimonial({
        body: value.body!.trim(),
        rating: value.rating,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.submitted = true;
        },
        error: (error) => {
          this.errorMessage =
            error.status === 403
              ? 'Your account must have a verified email, and public testimonial submission must be enabled.'
              : 'Unable to submit your testimonial right now.';
        },
      });
  }
}
