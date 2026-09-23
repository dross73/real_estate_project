import { Component, HostListener, OnInit } from '@angular/core';

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

import { AuthService } from '../../../services/auth.service';

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
  // Expose the current user's admin status to the layout template
  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  // Return the current user's role for display in the admin header
  get userRole(): string {
    return this.authService.getUserRole() ?? 'user';
  }

  /* Router service lets this layout react to route changes and update the page title */
  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}
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
    } else if (url.includes('/admin/security')) {
      this.pageTitle = 'Security';
    } else if (url.includes('/admin/analytics')) {
      this.pageTitle = 'Analytics';
    } else if (url.includes('/admin/listings')) {
      this.pageTitle = 'Listings';
    } else {
      this.pageTitle = 'Admin Dashboard';
    }
  }

  /* Toggles sidebar open/closed */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isSidebarOpen) {
      this.closeSidebar();
    }
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
