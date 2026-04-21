import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-users',
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent {
  searchTerm = '';

  // Placeholder user data for the table
  // Later this can be replaced with data from an API call
  users = [
    {
      name: 'Jane Admin',
      email: 'jane@example.com',
      role: 'Administrator',
      status: 'Active',
    },
    {
      name: 'Mark Editor',
      email: 'mark@example.com',
      role: 'Editor',
      status: 'Pending',
    },
    {
      name: 'Sara Staff',
      email: 'sara@example.com',
      role: 'Staff',
      status: 'Active',
    },
  ];
  // Returns only the users that match the current search text
  get filteredUsers() {
    // Remove extra spaces and make the search lowercase
    const term = this.searchTerm.trim().toLowerCase();

    // If the search box is empty, show all users
    if (!term) {
      return this.users;
    }

    //Otherwise, return only matching users
    return this.users.filter((user) => {
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term) ||
        user.status.toLowerCase().includes(term)
      );
    });
  }
}
