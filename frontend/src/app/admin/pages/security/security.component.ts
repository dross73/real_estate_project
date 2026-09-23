import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import {
  MfaEnrollmentStartResponse,
  MfaStatusResponse,
} from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-security',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
})
export class SecurityComponent implements OnInit {
  status: MfaStatusResponse | null = null;
  enrollment: MfaEnrollmentStartResponse | null = null;
  recoveryCodes: string[] = [];

  isLoading = true;
  isWorking = false;
  errorMessage = '';
  successMessage = '';

  readonly enrollmentForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly disableForm = this.formBuilder.group({
    currentPassword: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(64)]],
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  startEnrollment(): void {
    if (this.isWorking) {
      return;
    }

    this.beginWork();
    this.authService
      .startMfaEnrollment()
      .pipe(finalize(() => (this.isWorking = false)))
      .subscribe({
        next: (enrollment) => {
          this.enrollment = enrollment;
          this.recoveryCodes = [];
        },
        error: () => {
          this.errorMessage = 'Unable to start MFA enrollment.';
        },
      });
  }

  confirmEnrollment(): void {
    if (
      this.enrollmentForm.invalid ||
      !this.enrollment ||
      this.isWorking
    ) {
      this.enrollmentForm.markAllAsTouched();
      return;
    }

    this.beginWork();
    this.authService
      .confirmMfaEnrollment(
        this.enrollment.enrollment_token,
        this.enrollmentForm.controls.code.value ?? '',
      )
      .pipe(finalize(() => (this.isWorking = false)))
      .subscribe({
        next: (response) => {
          this.recoveryCodes = response.recovery_codes;
          this.enrollment = null;
          this.enrollmentForm.reset();
          this.successMessage = 'MFA is now enabled.';
          this.loadStatus(false);
        },
        error: () => {
          this.errorMessage =
            'The authenticator code is invalid or enrollment expired.';
        },
      });
  }

  disableMfa(): void {
    if (this.disableForm.invalid || this.isWorking) {
      this.disableForm.markAllAsTouched();
      return;
    }

    this.beginWork();
    const value = this.disableForm.getRawValue();
    this.authService
      .disableMfa(value.currentPassword ?? '', value.code ?? '')
      .pipe(finalize(() => (this.isWorking = false)))
      .subscribe({
        next: () => {
          this.disableForm.reset();
          this.recoveryCodes = [];
          this.successMessage = 'MFA has been disabled.';
          this.loadStatus(false);
        },
        error: () => {
          this.errorMessage =
            'Unable to disable MFA. Check your password and verification code.';
        },
      });
  }

  private loadStatus(showLoading = true): void {
    if (showLoading) {
      this.isLoading = true;
    }
    this.errorMessage = '';

    this.authService
      .getMfaStatus()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (status) => {
          this.status = status;
        },
        error: () => {
          this.errorMessage = 'Unable to load MFA status.';
        },
      });
  }

  private beginWork(): void {
    this.isWorking = true;
    this.errorMessage = '';
    this.successMessage = '';
  }
}
