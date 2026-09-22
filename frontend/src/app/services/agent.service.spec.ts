import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AgentService } from './agent.service';

describe('AgentService', () => {
  let service: AgentService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(AgentService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should load active agents for listing assignment', () => {
    service.getAgents(true).subscribe();

    const request = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/agents' &&
        candidate.params.get('active_only') === 'true',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('should load one anonymous public agent profile', () => {
    service.getPublicAgent(8).subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/public/agents/8',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      id: 8,
      full_name: 'Jane Morgan',
      professional_title: 'REALTOR',
      email: 'jane@example.com',
      phone: null,
      photo_url: null,
      office_name: null,
      bio: null,
    });
  });
});
