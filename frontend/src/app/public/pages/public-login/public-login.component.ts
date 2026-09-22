import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-public-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './public-login.component.html',
  styleUrl: './public-login.component.css',
})
export class PublicLoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isSubmitting = false;
  errorMessage = '';

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid || this.isSubmitting) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const value = this.loginForm.getRawValue();
    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService
      .login({
        email: value.email!.trim(),
        password: value.password!,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          if (this.authService.getUserRole() !== 'public_user') {
            this.authService.logout();
            this.errorMessage =
              'This sign-in page is for customer accounts. Use the admin sign-in for staff access.';
            return;
          }

          void this.router.navigate(['/account']);
        },
        error: () => {
          this.errorMessage = 'The email or password was not accepted.';
        },
      });
  }
}
