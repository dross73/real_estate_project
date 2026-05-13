import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-listings',
  imports: [CommonModule, FormsModule],
  templateUrl: './listings.component.html',
  styleUrl: './listings.component.css',
})
export class ListingsComponent {
  // Stores the current text typed into the listing search input
  searchTerm = '';

  // Temporary sample data for the admin listings page
  // Later, this will be replaced with data from the FastAPI backend
  listings = [
    {
      title: 'Modern Family Home',
      address: '123 Maple Street, Ames, IA',
      price: 325000,
      status: 'Active',
      bedrooms: 4,
      bathrooms: 3,
    },
    {
      title: 'Downtown Condo',
      address: '45 Main Avenue, Des Moines, IA',
      price: 215000,
      status: 'Pending',
      bedrooms: 2,
      bathrooms: 2,
    },
    {
      title: 'Country Acreage',
      address: '890 Rural Route, Boone, IA',
      price: 475000,
      status: 'Draft',
      bedrooms: 5,
      bathrooms: 4,
    },
  ];

  // Returns listings that match the current search term
  // This keeps the filtering logic in TypeScript instead of cluttering the HTML
  get filteredListings(): typeof this.listings {
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      return this.listings;
    }

    return this.listings.filter((listing) => {
      return (
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term) ||
        listing.status.toLowerCase().includes(term)
      );
    });
  }
}
