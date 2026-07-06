import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';

import { User } from '../../../models/user';
import { UserService } from '../../../services/user.service';

@Component({
  standalone: true,
  selector: 'app-users',
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  // Stores the current text typed into the user search input
  searchTerm = '';

  // Users loaded from the FastAPI backend
  users: User[] = [];

  // Tracks whether the users request is still running
  isLoading = false;

  // Stores a user-friendly error message if the request fails
  errorMessage = '';

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // Loads users from the backend and updates the pages state
  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load users. Please try again.';
        this.isLoading = false;
      },
    });
  }

  // Returns only the users that match the current search text
  get filteredUsers(): User[] {
    // Remove extra spaces and make the search lowercase
    const term = this.searchTerm.trim().toLowerCase();

    // If the search box is empty, show all users
    if (!term) {
      return this.users;
    }

    // Otherwise, return only matching users
    return this.users.filter((user) => {
      const name = user.full_name ?? '';
      const status = user.is_active ? 'active' : 'inactive';

      return (
        name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term) ||
        status.includes(term)
      );
    });
  }
}
