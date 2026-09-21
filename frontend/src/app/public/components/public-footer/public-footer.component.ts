import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PUBLIC_SITE_BRAND } from '../../public-site.config';

@Component({
  selector: 'app-public-footer',
  imports: [RouterLink],
  templateUrl: './public-footer.component.html',
  styleUrl: './public-footer.component.css',
})
export class PublicFooterComponent {
  readonly brand = PUBLIC_SITE_BRAND;
  readonly currentYear = new Date().getFullYear();
}
