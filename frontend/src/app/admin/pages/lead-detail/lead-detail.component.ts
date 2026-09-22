import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import {
  AssignmentOption,
  Lead,
  LeadStatus,
  LeadUpdate,
} from '../../../models/lead';
import { LeadService } from '../../../services/lead.service';

@Component({
  selector: 'app-lead-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.css',
})
export class LeadDetailComponent implements OnInit {
  readonly statuses: LeadStatus[] = [
    'New',
    'Contacted',
    'Qualified',
    'Closed',
    'Lost',
  ];

  lead: Lead | null = null;
  assignmentOptions: AssignmentOption[] = [];
  selectedStatus: LeadStatus = 'New';
  selectedAssignment = 'none';
  noteText = '';
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly leadService: LeadService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id <= 0) {
      this.errorMessage = 'Unable to identify this lead.';
      this.isLoading = false;
      return;
    }

    forkJoin({
      lead: this.leadService.getLead(id),
      options: this.leadService.getAssignmentOptions(),
    }).subscribe({
      next: ({ lead, options }) => {
        this.lead = lead;
        this.assignmentOptions = options.items;
        this.syncControls(lead);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load this lead.';
        this.isLoading = false;
      },
    });
  }

  saveLead(): void {
    if (!this.lead || this.isSaving) return;

    const payload: LeadUpdate = {
      status: this.selectedStatus,
      assigned_agent_id: null,
      assigned_user_id: null,
    };

    if (this.selectedAssignment.startsWith('agent:')) {
      payload.assigned_agent_id = Number(this.selectedAssignment.split(':')[1]);
    } else if (this.selectedAssignment.startsWith('staff:')) {
      payload.assigned_user_id = Number(this.selectedAssignment.split(':')[1]);
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.leadService
      .updateLead(this.lead.id, payload)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (lead) => {
          this.lead = lead;
          this.syncControls(lead);
          this.successMessage = 'Lead updated.';
        },
        error: () => {
          this.errorMessage = 'Unable to update this lead.';
        },
      });
  }

  addNote(): void {
    if (!this.lead || !this.noteText.trim() || this.isSaving) return;

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.leadService
      .addNote(this.lead.id, this.noteText.trim())
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (lead) => {
          this.lead = lead;
          this.noteText = '';
          this.successMessage = 'Internal note added.';
        },
        error: () => {
          this.errorMessage = 'Unable to add the internal note.';
        },
      });
  }

  activityLabel(activityType: string): string {
    return activityType.replace(/_/g, ' ');
  }

  private syncControls(lead: Lead): void {
    this.selectedStatus = lead.status;

    if (lead.assigned_agent_id !== null) {
      this.selectedAssignment = `agent:${lead.assigned_agent_id}`;
    } else if (lead.assigned_user_id !== null) {
      this.selectedAssignment = `staff:${lead.assigned_user_id}`;
    } else {
      this.selectedAssignment = 'none';
    }
  }
}
