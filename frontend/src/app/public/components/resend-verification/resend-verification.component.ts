import { Component, inject, Input, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-resend-verification',
  imports: [ReactiveFormsModule],
  templateUrl: './resend-verification.component.html',
  styles: [':host { display: block; margin-top: 1.25rem; }'],
})
export class ResendVerificationComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  @Input() email = '';
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  readonly resendForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    this.resendForm.controls.email.setValue(this.email);
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    const email = this.resendForm.controls.email.value.trim();
    this.resendForm.controls.email.setValue(email);
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.authService.resendVerification(email)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => (this.successMessage = response.message),
        error: () => {
          this.errorMessage = 'We couldn’t send a verification email right now. Please try again.';
        },
      });
  }
}
