import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Lead } from '../../../models/lead';
import { LeadService } from '../../../services/lead.service';
import { LeadDetailComponent } from './lead-detail.component';

describe('LeadDetailComponent', () => {
  let fixture: ComponentFixture<LeadDetailComponent>;
  let component: LeadDetailComponent;
  let leadService: jasmine.SpyObj<LeadService>;

  const lead: Lead = {
    id: 8,
    inquiry_type: 'contact',
    status: 'New',
    requester_user_id: null,
    contact_name: 'Taylor Morgan',
    contact_email: 'taylor@example.com',
    contact_phone: null,
    listing_id: null,
    listing_title: null,
    message: 'I have a question.',
    preferred_at: null,
    source: 'public_contact',
    assigned_agent_id: 3,
    assigned_user_id: null,
    assigned_to_label: 'Jane Morgan',
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    activities: [
      {
        id: 1,
        activity_type: 'created',
        actor_email: 'system@example.com',
        note: null,
        details: {},
        created_at: '2026-09-22T00:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    leadService = jasmine.createSpyObj<LeadService>('LeadService', [
      'getLead',
      'getAssignmentOptions',
      'updateLead',
      'addNote',
    ]);
    leadService.getLead.and.returnValue(of(lead));
    leadService.getAssignmentOptions.and.returnValue(
      of({
        items: [
          {
            kind: 'agent',
            id: 3,
            name: 'Jane Morgan',
            subtitle: 'REALTOR',
          },
          {
            kind: 'staff',
            id: 9,
            name: 'Staff Member',
            subtitle: 'staff',
          },
        ],
      }),
    );
    leadService.updateLead.and.returnValue(
      of({
        ...lead,
        status: 'Contacted',
      }),
    );
    leadService.addNote.and.returnValue(
      of({
        ...lead,
        activities: [
          ...lead.activities,
          {
            id: 2,
            activity_type: 'note',
            actor_email: 'staff@example.com',
            note: 'Called the buyer.',
            details: {},
            created_at: '2026-09-22T01:00:00Z',
          },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [LeadDetailComponent],
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
        { provide: LeadService, useValue: leadService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the lead and assignment options', () => {
    expect(leadService.getLead).toHaveBeenCalledWith(8);
    expect(leadService.getAssignmentOptions).toHaveBeenCalled();
    expect(component.selectedAssignment).toBe('agent:3');
  });

  it('should save status and reassignment together', () => {
    component.selectedStatus = 'Contacted';
    component.selectedAssignment = 'staff:9';

    component.saveLead();

    expect(leadService.updateLead).toHaveBeenCalledWith(8, {
      status: 'Contacted',
      assigned_agent_id: null,
      assigned_user_id: 9,
    });
  });

  it('should add internal notes and clear the note field', () => {
    component.noteText = 'Called the buyer.';

    component.addNote();

    expect(leadService.addNote).toHaveBeenCalledWith(
      8,
      'Called the buyer.',
    );
    expect(component.noteText).toBe('');
  });
});
