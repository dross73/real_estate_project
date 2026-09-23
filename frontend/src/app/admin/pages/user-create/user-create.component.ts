import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { UserCreate } from '../../../models/user';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-user-create',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-create.component.html',
  styleUrl: './user-create.component.css',
})
export class UserCreateComponent {
  // Build and manage the reactive user form
  private readonly formBuilder = inject(FormBuilder);

  // Navigate between admin pages
  private readonly router = inject(Router);

  // Send user requests to the FastAPI backend
  private readonly userService = inject(UserService);

  // Track whether the create request is currently being processed
  readonly isSubmitting = signal(false);

  // Store a user-friendly error message if the save fails
  readonly errorMessage = signal('');

  // Role options supported by the backend users.role field
  readonly roleOptions = ['admin', 'staff'];

  // Define the form controls and frontend validation rules
  readonly userForm = this.formBuilder.group({
    full_name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['staff', [Validators.required]],
    is_active: [true],
  });

  // Return to the users page
  onCancel(): void {
    this.router.navigate(['/admin/users']);
  }

  // Handle the form submission
  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    const formValue = this.userForm.getRawValue();

    // Convert the validated form values into the format expected by FastAPI
    const user: UserCreate = {
      full_name: formValue.full_name!.trim(),
      email: formValue.email!.trim().toLowerCase(),
      password: formValue.password!,
      role: formValue.role as UserCreate['role'],
      is_active: formValue.is_active!,
    };

    // Mark the form as submitting before starting the backend request
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    // Send the completed user to the FastAPI backend
    this.userService.createUser(user).subscribe({
      next: () => {
        this.router.navigate(['/admin/users']);
      },
      error: () => {
        this.errorMessage.set('Unable to create user. Please try again.');
        this.isSubmitting.set(false);
      },
    });
  }
}
