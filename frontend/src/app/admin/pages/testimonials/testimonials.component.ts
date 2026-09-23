import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  Testimonial,
  TestimonialSource,
  TestimonialStatus,
} from '../../../models/testimonial';
import { TestimonialService } from '../../../services/testimonial.service';

@Component({
  selector: 'app-testimonials',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.css',
})
export class TestimonialsComponent implements OnInit {
  readonly statuses: Array<TestimonialStatus | ''> = [
    '',
    'Pending',
    'Approved',
    'Rejected',
  ];
  readonly sources: Array<TestimonialSource | ''> = ['', 'internal', 'public'];

  testimonials: Testimonial[] = [];
  statusFilter: TestimonialStatus | '' = '';
  sourceFilter: TestimonialSource | '' = '';
  isLoading = true;
  busyId: number | null = null;
  errorMessage = '';

  constructor(private readonly testimonialService: TestimonialService) {}

  ngOnInit(): void {
    this.loadTestimonials();
  }

  loadTestimonials(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.testimonialService
      .getTestimonials({
        ...(this.statusFilter ? { status: this.statusFilter } : {}),
        ...(this.sourceFilter ? { source: this.sourceFilter } : {}),
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (testimonials) => {
          this.testimonials = testimonials;
        },
        error: () => {
          this.errorMessage = 'Unable to load testimonials.';
        },
      });
  }

  setStatus(testimonial: Testimonial, status: TestimonialStatus): void {
    if (this.busyId !== null || testimonial.status === status) {
      return;
    }

    this.busyId = testimonial.id;
    this.errorMessage = '';

    this.testimonialService
      .updateTestimonial(testimonial.id, { status })
      .pipe(finalize(() => (this.busyId = null)))
      .subscribe({
        next: (updated) => {
          this.testimonials = this.testimonials.map((item) =>
            item.id === updated.id ? updated : item,
          );
        },
        error: () => {
          this.errorMessage = 'Unable to update testimonial status.';
        },
      });
  }

  deleteTestimonial(testimonial: Testimonial): void {
    if (this.busyId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the testimonial from ${testimonial.author_name}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    this.busyId = testimonial.id;
    this.errorMessage = '';

    this.testimonialService
      .deleteTestimonial(testimonial.id)
      .pipe(finalize(() => (this.busyId = null)))
      .subscribe({
        next: () => {
          this.testimonials = this.testimonials.filter(
            (item) => item.id !== testimonial.id,
          );
        },
        error: () => {
          this.errorMessage = 'Unable to delete the testimonial.';
        },
      });
  }

  resetFilters(): void {
    this.statusFilter = '';
    this.sourceFilter = '';
    this.loadTestimonials();
  }
}
