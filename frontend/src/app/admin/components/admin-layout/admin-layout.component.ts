import { Component, OnInit } from '@angular/core';

/*  RouterOutlet directive allows this layout to render child routes  */
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';

import { MatIconModule } from '@angular/material/icon';

import { CommonModule } from '@angular/common';

import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    CommonModule,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
})
export class AdminLayoutComponent implements OnInit {
  /* tracks whether the sidebar is open on mobile */
  isSidebarOpen = false;
  pageTitle = 'Admin Panel';
  /* Router service lets this layout react to route changes and update the page title */
  constructor(private router: Router) {}
  /* Runs once when the component loads */
  ngOnInit(): void {
    this.updatePageTitle(this.router.url);
    /* Listen for completed route changes so the header title updates during navigation */
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updatePageTitle((event as NavigationEnd).urlAfterRedirects);
      });
  }

  /* Set the header title based on the current admin route */
  updatePageTitle(url: string): void {
    if (url.includes('/admin/users')) {
      this.pageTitle = 'Users';
    } else if (url.includes('/admin/listings')) {
      this.pageTitle = 'Listings';
    } else {
      this.pageTitle = 'Admin Dashboard';
    }
  }

  /* Toggles sidebar open/closed */
  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }
}
