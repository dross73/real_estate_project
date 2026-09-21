import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { PUBLIC_SITE_BRAND } from '../../public-site.config';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './public-header.component.html',
  styleUrl: './public-header.component.css',
})
export class PublicHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly brand = PUBLIC_SITE_BRAND;

  // Track the compact navigation independently from the desktop navigation.
  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  get isPublicUser(): boolean {
    return (
      this.authService.isAuthenticated() &&
      this.authService.getUserRole() === 'public_user'
    );
  }

  logout(): void {
    this.authService.logout();
    this.closeMenu();
    void this.router.navigate(['/']);
  }
}
