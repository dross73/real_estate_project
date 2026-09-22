import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AgentProfileCreate } from '../../../models/agent';
import { Office } from '../../../models/office';
import { AgentService } from '../../../services/agent.service';
import { OfficeService } from '../../../services/office.service';

@Component({
  selector: 'app-agent-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agent-form.component.html',
  styleUrl: './agent-form.component.css',
})
export class AgentFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agentService = inject(AgentService);
  private readonly officeService = inject(OfficeService);

  agentId: number | null = null;
  isLoading = false;
  isSubmitting = false;
  errorMessage = '';
  offices: Office[] = [];

  readonly form = this.formBuilder.group({
    full_name: ['', [Validators.required, Validators.maxLength(120)]],
    professional_title: ['', [Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.maxLength(40)]],
    photo_url: [''],
    office_id: this.formBuilder.control<number | null>(null),
    bio: ['', [Validators.maxLength(5000)]],
    is_active: [true],
    is_public: [true],
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const isEdit = Number.isInteger(id) && id > 0;
    this.loadOffices(!isEdit);

    if (isEdit) {
      this.agentId = id;
      this.isLoading = true;
      this.agentService.getAgent(id).subscribe({
        next: (agent) => {
          this.form.patchValue({
            full_name: agent.full_name,
            professional_title: agent.professional_title ?? '',
            email: agent.email,
            phone: agent.phone ?? '',
            photo_url: agent.photo_url ?? '',
            office_id: agent.office_id ?? null,
            bio: agent.bio ?? '',
            is_active: agent.is_active,
            is_public: agent.is_public,
          });
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Unable to load the agent profile.';
          this.isLoading = false;
        },
      });
    }
  }

  private loadOffices(defaultSingleOffice: boolean): void {
    this.officeService.getOffices(!this.agentId).subscribe({
      next: (offices) => {
        this.offices = offices;

        if (
          defaultSingleOffice &&
          offices.length === 1 &&
          this.form.controls.office_id.value === null
        ) {
          this.form.controls.office_id.setValue(offices[0].id);
        }
      },
      error: () => {
        this.offices = [];
      },
    });
  }

  private nullable(value: string | null): string | null {
    return value?.trim() || null;
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: AgentProfileCreate = {
      full_name: value.full_name!.trim(),
      professional_title: this.nullable(value.professional_title),
      email: value.email!.trim(),
      phone: this.nullable(value.phone),
      photo_url: this.nullable(value.photo_url),
      office_id: value.office_id ?? null,
      bio: this.nullable(value.bio),
      is_active: Boolean(value.is_active),
      is_public: Boolean(value.is_public),
    };

    this.isSubmitting = true;
    this.errorMessage = '';

    const request = this.agentId
      ? this.agentService.updateAgent(this.agentId, payload)
      : this.agentService.createAgent(payload);

    request.subscribe({
      next: () => void this.router.navigate(['/admin/agents']),
      error: () => {
        this.errorMessage = 'Unable to save the agent profile.';
        this.isSubmitting = false;
      },
    });
  }

  cancel(): void {
    void this.router.navigate(['/admin/agents']);
  }
}
