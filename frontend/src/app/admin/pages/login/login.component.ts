import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  // Build and manage the login form
  private readonly formBuilder = inject(FormBuilder);

  // Send login requests to FastAPI
  private readonly authService = inject(AuthService);

  // Navigate to the dashboard after a successful login
  private readonly router = inject(Router);

  // Track whether the login request is being processed
  readonly isSubmitting = signal(false);

  // Store a user-friendly login error message
  readonly errorMessage = signal('');

  // Define the email and password fields
  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  // Validate and submit the login form
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const credentials = {
      email: this.loginForm.controls.email.value ?? '',
      password: this.loginForm.controls.password.value ?? '',
    };

    this.authService.login(credentials).subscribe({
      next: () => {
        this.router.navigate(['/admin/dashboard']);
      },
      error: () => {
        this.errorMessage.set(
          'The email or password is incorrect. Please try again.',
        );
        this.isSubmitting.set(false);
      },
    });
  }
}