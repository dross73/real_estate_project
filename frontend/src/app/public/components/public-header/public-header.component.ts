import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { PUBLIC_SITE_BRAND } from '../../public-site.config';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './public-header.component.html',
  styleUrl: './public-header.component.css',
})
export class PublicHeaderComponent {
  readonly brand = PUBLIC_SITE_BRAND;

  // Track the compact navigation independently from the desktop navigation.
  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }
}
