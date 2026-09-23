import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { PublicAgentProfile } from '../../../models/agent';
import { AgentService } from '../../../services/agent.service';
import { SeoService } from '../../../services/seo.service';
import { PublicListing } from '../../models/public-listing';
import { PublicListingService } from '../../services/public-listing.service';

@Component({
  selector: 'app-agent-profile',
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './agent-profile.component.html',
  styleUrl: './agent-profile.component.css',
})
export class AgentProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly agentService = inject(AgentService);
  private readonly listingService = inject(PublicListingService);
  private readonly seo = inject(SeoService);

  agent: PublicAgentProfile | null = null;
  listings: PublicListing[] = [];
  isLoading = true;
  notFound = false;
  loadError = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id <= 0) {
      this.isLoading = false;
      this.notFound = true;
      return;
    }

    forkJoin({
      agent: this.agentService.getPublicAgent(id),
      listings: this.listingService.searchListings({
        agent_id: id,
        page: 1,
        per_page: 12,
        sort: 'newest',
      }),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ agent, listings }) => {
          this.agent = agent;
          this.listings = listings.items;
          this.seo.setAgent(agent);
        },
        error: (error) => {
          if (error.status === 404) {
            this.notFound = true;
          } else {
            this.loadError = true;
          }
        },
      });
  }

  listingLocation(listing: PublicListing): string {
    return listing.address
      ? `${listing.address}, ${listing.city}, ${listing.state}`
      : `${listing.city}, ${listing.state}`;
  }
}
