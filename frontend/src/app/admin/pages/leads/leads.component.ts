import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Lead, LeadStatus, LeadType } from '../../../models/lead';
import { LeadService } from '../../../services/lead.service';

@Component({
  selector: 'app-leads',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.css',
})
export class LeadsComponent implements OnInit {
  readonly statusOptions: Array<LeadStatus | ''> = [
    '',
    'New',
    'Contacted',
    'Qualified',
    'Closed',
    'Lost',
  ];
  readonly typeOptions: Array<LeadType | ''> = [
    '',
    'contact',
    'showing',
    'open_house',
  ];

  leads: Lead[] = [];
  total = 0;
  searchTerm = '';
  statusFilter: LeadStatus | '' = '';
  typeFilter: LeadType | '' = '';
  isLoading = true;
  errorMessage = '';

  constructor(private readonly leadService: LeadService) {}

  ngOnInit(): void {
    this.loadLeads();
  }

  loadLeads(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.leadService
      .getLeads({
        ...(this.statusFilter ? { status: this.statusFilter } : {}),
        ...(this.typeFilter ? { inquiry_type: this.typeFilter } : {}),
        ...(this.searchTerm.trim() ? { q: this.searchTerm.trim() } : {}),
      })
      .subscribe({
        next: (response) => {
          this.leads = response.items;
          this.total = response.total;
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Unable to load leads and inquiries.';
          this.isLoading = false;
        },
      });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.typeFilter = '';
    this.loadLeads();
  }

  typeLabel(type: LeadType): string {
    if (type === 'open_house') return 'Open House';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
