import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';
import { ResendVerificationComponent } from '../../components/resend-verification/resend-verification.component';

function passwordByteLimit(control: AbstractControl): ValidationErrors | null {
  return new TextEncoder().encode(control.value ?? '').length > 72
    ? { passwordTooLong: true }
    : null;
}

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  return control.get('password')?.value === control.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };
}

@Component({
  selector: 'app-public-register',
  imports: [ReactiveFormsModule, RouterLink, ResendVerificationComponent],
  templateUrl: './public-register.component.html',
})
export class PublicRegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  isSubmitting = false;
  registrationComplete = false;
  registeredEmail = '';
  errorMessage = '';

  readonly registrationForm = this.formBuilder.nonNullable.group({
    full_name: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), passwordByteLimit]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: matchingPasswords });

  onSubmit(): void {
    if (this.isSubmitting || this.registrationComplete) {
      return;
    }

    this.registrationForm.controls.full_name.setValue(this.registrationForm.controls.full_name.value.trim());
    this.registrationForm.controls.email.setValue(this.registrationForm.controls.email.value.trim());
    if (this.registrationForm.invalid) {
      this.registrationForm.markAllAsTouched();
      return;
    }

    const { full_name, email, password } = this.registrationForm.getRawValue();
    this.isSubmitting = true;
    this.errorMessage = '';
    this.authService.register({ full_name, email, password })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (account) => {
          this.registeredEmail = account.email;
          this.registrationComplete = true;
          this.registrationForm.reset();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = error.status === 409
            ? 'An account already uses this email. Sign in or request a new verification email.'
            : error.status === 422
              ? 'We couldn’t accept these account details. Check your name, email, and password and try again.'
              : 'We couldn’t create your account right now. Please try again.';
        },
      });
  }
}
