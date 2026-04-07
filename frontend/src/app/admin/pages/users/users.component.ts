import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-users',
  imports: [CommonModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent {
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
    }
  ];
}
