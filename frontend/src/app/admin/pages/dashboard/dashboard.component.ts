import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import { Listing } from '../../../models/listing';
import { AuthService } from '../../../services/auth.service';
import { ListingService } from '../../../services/listing.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  // Stores dashboard values loaded from the FastAPI backend.
  totalListings = 0;
  activeUsers = 0;
  listingSnapshot: Listing[] = [];

  // Tracks which role-sensitive dashboard content should be displayed.
  isAdmin = false;

  // Tracks loading and error states for listing data.
  isListingsLoading = true;
  listingsErrorMessage = '';

  // Tracks loading and error states for admin-only user data.
  isUsersLoading = false;
  usersErrorMessage = '';

  constructor(
    private listingService: ListingService,
    private userService: UserService,
    private authService: AuthService,
  ) {}

  // Loads dashboard data when the page opens.
  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();

    this.loadListings();

    // Staff users must never request the admin-only users endpoint.
    if (this.isAdmin) {
      this.loadActiveUsers();
    }
  }

  // Loads the total listing count and a small listing snapshot.
  private loadListings(): void {
    this.isListingsLoading = true;
    this.listingsErrorMessage = '';

    this.listingService.getListings(1, 3).subscribe({
      next: (response) => {
        this.totalListings = response.total;
        this.listingSnapshot = response.items.slice(0, 3);
        this.isListingsLoading = false;
      },
      error: () => {
        this.totalListings = 0;
        this.listingSnapshot = [];
        this.listingsErrorMessage =
          'Unable to load listing information. Please try again later.';
        this.isListingsLoading = false;
      },
    });
  }

  // Loads the active-user count for administrators only.
  private loadActiveUsers(): void {
    this.isUsersLoading = true;
    this.usersErrorMessage = '';

    this.userService.getUsers().subscribe({
      next: (users) => {
        this.activeUsers = users.filter((user) => user.is_active).length;
        this.isUsersLoading = false;
      },
      error: () => {
        this.activeUsers = 0;
        this.usersErrorMessage =
          'Unable to load user information. Please try again later.';
        this.isUsersLoading = false;
      },
    });
  }
}
