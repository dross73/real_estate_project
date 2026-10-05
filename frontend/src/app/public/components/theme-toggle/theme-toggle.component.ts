import { Component, inject } from '@angular/core';

import { PublicThemeService } from '../../../services/public-theme.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
})
export class ThemeToggleComponent {
  readonly theme = inject(PublicThemeService);

  get label(): string {
    return this.theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}
