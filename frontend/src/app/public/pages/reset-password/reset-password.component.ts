import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  token = '';
  isSubmitting = false;
  resetComplete = false;
  errorMessage = '';

  readonly resetForm = this.formBuilder.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.errorMessage =
        'This password-reset link is missing its security token. Request a new link.';
    }
  }

  onSubmit(): void {
    if (!this.token || this.resetForm.invalid || this.isSubmitting) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const value = this.resetForm.getRawValue();

    if (value.newPassword !== value.confirmPassword) {
      this.errorMessage = 'The new passwords do not match.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService
      .resetPassword(this.token, value.newPassword!)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.resetComplete = true;
          this.resetForm.reset();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage =
            error.status === 400
              ? 'This password-reset link is invalid, expired, or has already been used.'
              : 'We couldn’t reset the password right now. Please try again.';
        },
      });
  }
}
