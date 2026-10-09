import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';
import { ResendVerificationComponent } from '../../components/resend-verification/resend-verification.component';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, ResendVerificationComponent],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  isVerifying = false;
  verificationComplete = false;
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.errorMessage = 'This verification link is missing its security token. Request a new email below.';
      return;
    }

    this.isVerifying = true;
    this.authService.verifyEmail(token)
      .pipe(finalize(() => (this.isVerifying = false)))
      .subscribe({
        next: (response) => {
          this.verificationComplete = true;
          this.successMessage = response.status === 'already_verified'
            ? 'Your email is already verified. You can sign in to your account.'
            : 'Your email has been verified. You can now sign in to your account.';
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = error.status === 400 || error.status === 422
            ? 'This verification link is invalid, expired, or has already been used. Try signing in if you already verified your email, or request a new link below.'
            : 'We couldn’t verify your email right now. Try opening the link again or request a new email below.';
        },
      });
  }
}
