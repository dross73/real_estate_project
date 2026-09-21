import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-public-placeholder',
  templateUrl: './public-placeholder.component.html',
  styleUrl: './public-placeholder.component.css',
})
export class PublicPlaceholderComponent {
  // Route data keeps these temporary shell pages reusable until feature tickets replace them.
  readonly title = this.route.snapshot.data['title'] ?? 'Public Site';
  readonly message = this.route.snapshot.data['message'] ?? '';

  constructor(private readonly route: ActivatedRoute) {}
}
