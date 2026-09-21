import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PublicAccount } from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-account-settings',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './account-settings.component.html',
  styleUrl: './account-settings.component.css',
})
export class AccountSettingsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  account: PublicAccount | null = null;
  isLoading = true;
  profileBusy = false;
  passwordBusy = false;
  archiveBusy = false;
  archiveComplete = false;
  loadError = '';
  profileMessage = '';
  profileError = '';
  passwordMessage = '';
  passwordError = '';
  archiveError = '';

  readonly profileForm = this.formBuilder.group({
    fullName: ['', [Validators.maxLength(120)]],
    phone: ['', [Validators.maxLength(40)]],
  });

  readonly passwordForm = this.formBuilder.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  readonly archiveForm = this.formBuilder.group({
    currentPassword: ['', [Validators.required]],
    confirmation: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadAccount();
  }

  loadAccount(): void {
    this.isLoading = true;
    this.loadError = '';

    this.authService
      .getPublicAccount()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (account) => {
          this.account = account;
          this.profileForm.patchValue({
            fullName: account.full_name ?? '',
            phone: account.phone ?? '',
          });
        },
        error: (error: HttpErrorResponse) => {
          this.loadError =
            error.status === 403
              ? 'Verify your email before changing account settings.'
              : 'We couldn’t load your account settings. Please try again.';
        },
      });
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.profileBusy) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const value = this.profileForm.getRawValue();
    this.profileBusy = true;
    this.profileMessage = '';
    this.profileError = '';

    this.authService
      .updatePublicAccount({
        full_name: value.fullName?.trim() || null,
        phone: value.phone?.trim() || null,
      })
      .pipe(finalize(() => (this.profileBusy = false)))
      .subscribe({
        next: (account) => {
          this.account = account;
          this.profileMessage = 'Account details updated.';
        },
        error: () => {
          this.profileError =
            'We couldn’t update your account details. Please try again.';
        },
      });
  }

  archiveAccount(): void {
    if (this.archiveForm.invalid || this.archiveBusy) {
      this.archiveForm.markAllAsTouched();
      return;
    }

    const value = this.archiveForm.getRawValue();

    if (value.confirmation?.trim().toUpperCase() !== 'CLOSE') {
      this.archiveError = 'Type CLOSE to confirm account closure.';
      return;
    }

    this.archiveBusy = true;
    this.archiveError = '';

    this.authService
      .archivePublicAccount(value.currentPassword!)
      .pipe(finalize(() => (this.archiveBusy = false)))
      .subscribe({
        next: () => {
          this.authService.logout();
          this.account = null;
          this.archiveComplete = true;
          this.archiveForm.reset();
        },
        error: (error: HttpErrorResponse) => {
          this.archiveError =
            error.status === 400
              ? 'Your current password was not accepted.'
              : 'We couldn’t close the account right now. Please try again.';
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordBusy) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const value = this.passwordForm.getRawValue();

    if (value.newPassword !== value.confirmPassword) {
      this.passwordError = 'The new passwords do not match.';
      return;
    }

    this.passwordBusy = true;
    this.passwordMessage = '';
    this.passwordError = '';

    this.authService
      .changePublicAccountPassword({
        current_password: value.currentPassword!,
        new_password: value.newPassword!,
      })
      .pipe(finalize(() => (this.passwordBusy = false)))
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.passwordMessage = 'Password changed successfully.';
        },
        error: (error: HttpErrorResponse) => {
          this.passwordError =
            error.status === 400
              ? 'Your current password was not accepted.'
              : 'We couldn’t change the password right now. Please try again.';
        },
      });
  }
}
