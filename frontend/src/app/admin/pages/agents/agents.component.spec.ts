import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AgentService } from '../../../services/agent.service';
import { AgentsComponent } from './agents.component';

describe('AgentsComponent', () => {
  let fixture: ComponentFixture<AgentsComponent>;
  let component: AgentsComponent;
  let agentService: jasmine.SpyObj<AgentService>;

  const agents = [
    {
      id: 1,
      full_name: 'Jane Morgan',
      professional_title: 'REALTOR',
      email: 'jane@example.com',
      phone: '515-555-0100',
      photo_url: null,
      bio: null,
      office_name: 'Story City Office',
      office_id: 4,
      is_active: true,
      is_public: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 2,
      full_name: 'Alex Reed',
      professional_title: null,
      email: 'alex@example.com',
      phone: null,
      photo_url: null,
      bio: null,
      office_name: 'Ames Office',
      office_id: 5,
      is_active: true,
      is_public: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    agentService = jasmine.createSpyObj<AgentService>('AgentService', [
      'getAgents',
    ]);
    agentService.getAgents.and.returnValue(of(agents));

    await TestBed.configureTestingModule({
      imports: [AgentsComponent],
      providers: [
        provideRouter([]),
        { provide: AgentService, useValue: agentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentsComponent);
    component = fixture.componentInstance;
  });

  it('should load and filter the agent directory', () => {
    fixture.detectChanges();

    expect(agentService.getAgents).toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
    expect(component.agents.length).toBe(2);

    component.searchTerm = 'story city';

    expect(component.filteredAgents.map((agent) => agent.id)).toEqual([1]);
  });

  it('should expose a load error and stop the loading state', () => {
    agentService.getAgents.and.returnValue(
      throwError(() => new Error('offline')),
    );

    fixture.detectChanges();

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toContain('Unable to load');
  });
});
