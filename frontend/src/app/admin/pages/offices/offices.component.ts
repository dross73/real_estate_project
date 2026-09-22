import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Office } from '../../../models/office';
import { OfficeService } from '../../../services/office.service';

@Component({
  selector: 'app-offices',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './offices.component.html',
  styleUrl: './offices.component.css',
})
export class OfficesComponent implements OnInit {
  offices: Office[] = [];
  searchTerm = '';
  isLoading = true;
  errorMessage = '';

  constructor(private readonly officeService: OfficeService) {}

  ngOnInit(): void {
    this.officeService.getOffices().subscribe({
      next: (offices) => {
        this.offices = offices;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load offices.';
        this.isLoading = false;
      },
    });
  }

  get filteredOffices(): Office[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.offices;

    return this.offices.filter((office) =>
      [office.name, office.city, office.state, office.email ?? ''].some(
        (value) => value.toLowerCase().includes(term),
      ),
    );
  }
}
