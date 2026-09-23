import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { OfficeCreate } from '../../../models/office';
import { OfficeService } from '../../../services/office.service';

@Component({
  selector: 'app-office-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './office-form.component.html',
  styleUrl: './office-form.component.css',
})
export class OfficeFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly officeService = inject(OfficeService);

  officeId: number | null = null;
  isLoading = false;
  isSubmitting = false;
  errorMessage = '';

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    address_line1: ['', [Validators.required, Validators.maxLength(255)]],
    city: ['', [Validators.required, Validators.maxLength(100)]],
    state: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    postal_code: ['', [Validators.required, Validators.maxLength(20)]],
    phone: ['', [Validators.maxLength(40)]],
    email: ['', [Validators.email]],
    hours: ['', [Validators.maxLength(2000)]],
    is_active: [true],
    is_public: [true],
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isInteger(id) && id > 0) {
      this.officeId = id;
      this.isLoading = true;
      this.officeService.getOffice(id).subscribe({
        next: (office) => {
          this.form.patchValue({
            name: office.name,
            address_line1: office.address_line1,
            city: office.city,
            state: office.state,
            postal_code: office.postal_code,
            phone: office.phone ?? '',
            email: office.email ?? '',
            hours: office.hours ?? '',
            is_active: office.is_active,
            is_public: office.is_public,
          });
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Unable to load the office.';
          this.isLoading = false;
        },
      });
    }
  }

  private nullable(value: string | null): string | null {
    return value?.trim() || null;
  }

  submit(): void {
    // Normalize text fields before validation so harmless surrounding
    // whitespace does not make otherwise valid office data fail validation.
    const rawValue = this.form.getRawValue();
    this.form.patchValue(
      {
        name: rawValue.name?.trim() ?? '',
        address_line1: rawValue.address_line1?.trim() ?? '',
        city: rawValue.city?.trim() ?? '',
        state: rawValue.state?.trim().toUpperCase() ?? '',
        postal_code: rawValue.postal_code?.trim() ?? '',
        phone: rawValue.phone?.trim() ?? '',
        email: rawValue.email?.trim() ?? '',
        hours: rawValue.hours?.trim() ?? '',
      },
      { emitEvent: false },
    );

    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: OfficeCreate = {
      name: value.name!.trim(),
      address_line1: value.address_line1!.trim(),
      city: value.city!.trim(),
      state: value.state!.trim().toUpperCase(),
      postal_code: value.postal_code!.trim(),
      phone: this.nullable(value.phone),
      email: this.nullable(value.email),
      hours: this.nullable(value.hours),
      is_active: Boolean(value.is_active),
      is_public: Boolean(value.is_public),
    };

    this.isSubmitting = true;
    this.errorMessage = '';

    const request = this.officeId
      ? this.officeService.updateOffice(this.officeId, payload)
      : this.officeService.createOffice(payload);

    request.subscribe({
      next: () => void this.router.navigate(['/admin/offices']),
      error: () => {
        this.errorMessage = 'Unable to save the office.';
        this.isSubmitting = false;
      },
    });
  }

  cancel(): void {
    void this.router.navigate(['/admin/offices']);
  }
}
