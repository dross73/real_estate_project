import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-public-placeholder',
  templateUrl: './public-placeholder.component.html',
  styleUrl: './public-placeholder.component.css',
})
export class PublicPlaceholderComponent {
  readonly title: string;
  readonly message: string;

  // Route data keeps these temporary shell pages reusable until feature tickets replace them.
  constructor(private readonly route: ActivatedRoute) {
    this.title = this.route.snapshot.data['title'] ?? 'Public Site';
    this.message = this.route.snapshot.data['message'] ?? '';
  }
}
