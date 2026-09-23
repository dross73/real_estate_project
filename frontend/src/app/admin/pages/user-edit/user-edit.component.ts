import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserRole, UserUpdate } from '../../../models/user';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-user-edit',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-edit.component.html',
  styleUrl: './user-edit.component.css',
})
export class UserEditComponent implements OnInit {
  // Build and manage the reactive user edit form
  private readonly formBuilder = inject(FormBuilder);

  // Read the selected user ID from the route
  private readonly route = inject(ActivatedRoute);

  // Navigate between admin pages
  private readonly router = inject(Router);

  // Send user requests to the FastAPI backend
  private readonly userService = inject(UserService);

  // Perform protected administrator MFA recovery actions.
  private readonly authService = inject(AuthService);

  // Store the selected user ID for loading and saving
  private userId: number | null = null;

  // Track whether the existing user is still loading
  readonly isLoading = signal(true);

  // Track whether the update request is being processed
  readonly isSubmitting = signal(false);

  // Store a user-friendly page or save error message
  readonly errorMessage = signal('');

  // Track whether the existing user failed to load
  readonly hasLoadError = signal(false);

  // Archived public accounts remain visible to admins but cannot be reactivated here.
  readonly isArchived = signal(false);

  // Track the loaded role so MFA recovery is shown only for internal accounts.
  readonly loadedRole = signal<UserRole | null>(null);

  readonly isResettingMfa = signal(false);
  readonly mfaResetMessage = signal('');
  readonly mfaResetError = signal('');

  // Role options supported by the backend
  readonly roleOptions = ['admin', 'staff', 'public_user'];

  // Define the editable user fields
  readonly userForm = this.formBuilder.group({
    full_name: ['', [Validators.required]],
    role: ['staff', [Validators.required]],
    is_active: [true],
  });

  readonly mfaResetForm = this.formBuilder.group({
    currentPassword: ['', [Validators.required]],
  });

  // Load the selected user when the edit page opens
  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const userId = Number(idParam);

    // Stop if the route does not contain a valid user ID
    if (!idParam || !Number.isInteger(userId) || userId <= 0) {
      this.errorMessage.set('Unable to identify the selected user.');
      this.hasLoadError.set(true);
      this.isLoading.set(false);
      return;
    }

    this.userId = userId;
    this.loadUser(userId);
  }

  // Fetch the existing user and populate the edit form
  private loadUser(userId: number): void {
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        this.isArchived.set(Boolean(user.archived_at));
        this.loadedRole.set(user.role);

        this.userForm.patchValue({
          full_name: user.full_name ?? '',
          role: user.role,
          is_active: user.is_active,
        });

        if (user.archived_at) {
          this.userForm.controls.is_active.disable();
        }

        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load user. Please try again.');
        this.hasLoadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  isInternalUser(): boolean {
    const role = this.loadedRole();
    return role === 'admin' || role === 'staff';
  }

  resetMfa(): void {
    if (
      !this.isInternalUser() ||
      this.userId === null ||
      this.mfaResetForm.invalid ||
      this.isResettingMfa()
    ) {
      this.mfaResetForm.markAllAsTouched();
      return;
    }

    this.isResettingMfa.set(true);
    this.mfaResetError.set('');
    this.mfaResetMessage.set('');

    this.authService
      .adminResetMfa(
        this.userId,
        this.mfaResetForm.controls.currentPassword.value ?? '',
      )
      .subscribe({
        next: (response) => {
          this.mfaResetMessage.set(response.message);
          this.mfaResetForm.reset();
          this.isResettingMfa.set(false);
        },
        error: () => {
          this.mfaResetError.set(
            'Unable to reset MFA. Check your administrator password and try again.',
          );
          this.isResettingMfa.set(false);
        },
      });
  }

  // Return to the users page without saving changes
  onCancel(): void {
    this.router.navigate(['/admin/users']);
  }

  // Validate the form and submit the updated user
  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    if (this.userId === null) {
      this.errorMessage.set('Unable to identify the selected user.');
      return;
    }

    const formValue = this.userForm.getRawValue();

    // Convert the form values into the format expected by FastAPI
    const updatedUser: UserUpdate = {
      full_name: formValue.full_name!.trim(),
      role: formValue.role as UserUpdate['role'],
      is_active: formValue.is_active!,
    };

    // Prevent duplicate submissions while the update is running
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    // Send the updated user to the FastAPI backend
    this.userService.updateUser(this.userId, updatedUser).subscribe({
      next: () => {
        this.router.navigate(['/admin/users']);
      },
      error: () => {
        this.errorMessage.set('Unable to update user. Please try again.');
        this.isSubmitting.set(false);
      },
    });
  }
}
