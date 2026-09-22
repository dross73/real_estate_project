import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import {
  PublicSiteBrand,
  PUBLIC_SITE_BRAND,
  publicBrandFromSettings,
} from '../../public-site.config';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './public-header.component.html',
  styleUrl: './public-header.component.css',
})
export class PublicHeaderComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly siteSettingsService = inject(SiteSettingsService);

  brand: PublicSiteBrand = { ...PUBLIC_SITE_BRAND };
  logoUrl: string | null = null;
  showAbout = true;
  showContact = true;

  // Track the compact navigation independently from the desktop navigation.
  isMenuOpen = false;

  ngOnInit(): void {
    this.siteSettingsService.getPublicSettings().subscribe({
      next: (settings) => {
        this.brand = publicBrandFromSettings(settings);
        this.logoUrl = settings.logo_url;
        this.showAbout = settings.show_about;
        this.showContact = settings.show_contact;
      },
      // Keep approved static branding/navigation defaults if settings fail.
      error: () => undefined,
    });
  }

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
