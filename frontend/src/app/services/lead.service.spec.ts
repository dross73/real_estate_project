import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadService } from './lead.service';

describe('LeadService', () => {
  let service: LeadService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(LeadService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should pass lead filters to the API', () => {
    service
      .getLeads({
        status: 'New',
        inquiry_type: 'showing',
        q: 'Taylor',
      })
      .subscribe();

    const request = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/leads' &&
        candidate.params.get('status') === 'New' &&
        candidate.params.get('inquiry_type') === 'showing' &&
        candidate.params.get('q') === 'Taylor',
    );

    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0 });
  });

  it('should update lead workflow and add internal notes', () => {
    service
      .updateLead(7, {
        status: 'Contacted',
        assigned_agent_id: 3,
        assigned_user_id: null,
      })
      .subscribe();

    const update = httpController.expectOne(
      'http://localhost:8000/leads/7',
    );
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.assigned_agent_id).toBe(3);
    update.flush({
      id: 7,
      inquiry_type: 'contact',
      status: 'Contacted',
      requester_user_id: null,
      contact_name: 'Taylor Morgan',
      contact_email: 'taylor@example.com',
      contact_phone: null,
      listing_id: null,
      listing_title: null,
      message: null,
      preferred_at: null,
      source: null,
      assigned_agent_id: 3,
      assigned_user_id: null,
      assigned_to_label: 'Jane Morgan',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
      activities: [],
    });

    service.addNote(7, 'Called and left voicemail.').subscribe();

    const note = httpController.expectOne(
      'http://localhost:8000/leads/7/notes',
    );
    expect(note.request.method).toBe('POST');
    expect(note.request.body).toEqual({
      note: 'Called and left voicemail.',
    });
    note.flush({
      id: 7,
      inquiry_type: 'contact',
      status: 'Contacted',
      requester_user_id: null,
      contact_name: 'Taylor Morgan',
      contact_email: 'taylor@example.com',
      contact_phone: null,
      listing_id: null,
      listing_title: null,
      message: null,
      preferred_at: null,
      source: null,
      assigned_agent_id: 3,
      assigned_user_id: null,
      assigned_to_label: 'Jane Morgan',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
      activities: [],
    });
  });
});
