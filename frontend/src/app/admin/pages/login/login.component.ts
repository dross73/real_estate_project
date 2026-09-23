import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import {
  MfaEnrollmentStartResponse,
} from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';

type LoginStep =
  | 'credentials'
  | 'challenge'
  | 'enrollment'
  | 'recovery';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly step = signal<LoginStep>('credentials');
  readonly recoveryCodes = signal<string[]>([]);

  private challengeToken = '';
  private enrollmentToken = '';

  enrollment: MfaEnrollmentStartResponse | null = null;

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly codeForm = this.formBuilder.group({
    code: [
      '',
      [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(64),
      ],
    ],
  });

  onSubmit(): void {
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.beginSubmitting();

    const credentials = {
      email: this.loginForm.controls.email.value ?? '',
      password: this.loginForm.controls.password.value ?? '',
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        if (response.status === 'authenticated' && response.access_token) {
          this.router.navigate(['/admin/dashboard']);
          return;
        }

        if (!response.challenge_token) {
          this.fail('Unable to continue sign in. Please try again.');
          return;
        }

        this.challengeToken = response.challenge_token;

        if (response.status === 'mfa_required') {
          this.step.set('challenge');
          this.isSubmitting.set(false);
          return;
        }

        if (response.status === 'mfa_enrollment_required') {
          this.startRequiredEnrollment();
          return;
        }

        this.fail('Unable to continue sign in. Please try again.');
      },
      error: () => {
        this.fail('The email or password is incorrect. Please try again.');
      },
    });
  }

  submitChallenge(): void {
    if (this.codeForm.invalid || this.isSubmitting()) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.beginSubmitting();
    this.authService
      .verifyMfaChallenge(
        this.challengeToken,
        this.codeForm.controls.code.value ?? '',
      )
      .subscribe({
        next: (response) => {
          if (response.status === 'authenticated' && response.access_token) {
            this.router.navigate(['/admin/dashboard']);
            return;
          }
          this.fail('Unable to complete sign in. Please try again.');
        },
        error: () => {
          this.fail('The authenticator or recovery code is invalid.');
        },
      });
  }

  submitRequiredEnrollment(): void {
    if (
      this.codeForm.invalid ||
      this.isSubmitting() ||
      !this.enrollmentToken
    ) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.beginSubmitting();
    this.authService
      .confirmRequiredMfaEnrollment(
        this.challengeToken,
        this.enrollmentToken,
        this.codeForm.controls.code.value ?? '',
      )
      .subscribe({
        next: (response) => {
          if (!response.access_token) {
            this.fail('Unable to complete MFA enrollment. Please try again.');
            return;
          }

          this.recoveryCodes.set(response.recovery_codes);
          this.step.set('recovery');
          this.isSubmitting.set(false);
        },
        error: () => {
          this.fail('The authenticator code is invalid or enrollment expired.');
        },
      });
  }

  continueAfterRecoveryCodes(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  restart(): void {
    this.challengeToken = '';
    this.enrollmentToken = '';
    this.enrollment = null;
    this.recoveryCodes.set([]);
    this.codeForm.reset();
    this.errorMessage.set('');
    this.isSubmitting.set(false);
    this.step.set('credentials');
  }

  private startRequiredEnrollment(): void {
    this.authService
      .startRequiredMfaEnrollment(this.challengeToken)
      .subscribe({
        next: (enrollment) => {
          this.enrollment = enrollment;
          this.enrollmentToken = enrollment.enrollment_token;
          this.codeForm.reset();
          this.step.set('enrollment');
          this.isSubmitting.set(false);
        },
        error: () => {
          this.fail('Unable to start MFA enrollment. Please sign in again.');
        },
      });
  }

  private beginSubmitting(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set('');
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.isSubmitting.set(false);
  }
}
