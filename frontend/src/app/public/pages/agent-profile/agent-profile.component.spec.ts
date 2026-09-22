import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AgentService } from '../../../services/agent.service';
import { PublicListingService } from '../../services/public-listing.service';
import { AgentProfileComponent } from './agent-profile.component';

describe('AgentProfileComponent', () => {
  let fixture: ComponentFixture<AgentProfileComponent>;
  let component: AgentProfileComponent;
  let agentService: jasmine.SpyObj<AgentService>;
  let listingService: jasmine.SpyObj<PublicListingService>;

  beforeEach(async () => {
    agentService = jasmine.createSpyObj<AgentService>('AgentService', [
      'getPublicAgent',
    ]);
    listingService = jasmine.createSpyObj<PublicListingService>(
      'PublicListingService',
      ['searchListings'],
    );

    agentService.getPublicAgent.and.returnValue(
      of({
        id: 8,
        full_name: 'Jane Morgan',
        professional_title: 'REALTOR',
        email: 'jane@example.com',
        phone: '515-555-0110',
        photo_url: null,
        office_name: 'Juniper & Lane Realty',
        bio: 'Local guidance.',
      }),
    );
    listingService.searchListings.and.returnValue(
      of({ items: [], total: 0, page: 1, per_page: 12 }),
    );

    await TestBed.configureTestingModule({
      imports: [AgentProfileComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '8' }),
            },
          },
        },
        { provide: AgentService, useValue: agentService },
        { provide: PublicListingService, useValue: listingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load public profile and assigned public listings', () => {
    expect(agentService.getPublicAgent).toHaveBeenCalledWith(8);
    expect(listingService.searchListings).toHaveBeenCalledWith({
      agent_id: 8,
      page: 1,
      per_page: 12,
      sort: 'newest',
    });
    expect(component.agent?.full_name).toBe('Jane Morgan');
    expect(component.isLoading).toBeFalse();
  });
});
