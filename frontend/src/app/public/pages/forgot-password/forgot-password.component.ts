import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  readonly resetRequestForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.resetRequestForm.invalid || this.isSubmitting) {
      this.resetRequestForm.markAllAsTouched();
      return;
    }

    const email = this.resetRequestForm.controls.email.value!.trim();
    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.authService
      .requestPasswordReset(email)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = response.message;
        },
        error: () => {
          this.errorMessage =
            'We couldn’t process the request right now. Please try again.';
        },
      });
  }
}
