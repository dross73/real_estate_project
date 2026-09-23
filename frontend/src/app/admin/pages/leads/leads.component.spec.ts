import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ExportService } from '../../../services/export.service';
import { LeadService } from '../../../services/lead.service';
import { LeadsComponent } from './leads.component';

describe('LeadsComponent', () => {
  let fixture: ComponentFixture<LeadsComponent>;
  let component: LeadsComponent;
  let leadService: jasmine.SpyObj<LeadService>;
  let exportService: jasmine.SpyObj<ExportService>;

  beforeEach(async () => {
    leadService = jasmine.createSpyObj<LeadService>('LeadService', [
      'getLeads',
    ]);
    exportService = jasmine.createSpyObj<ExportService>('ExportService', [
      'exportLeads',
      'saveCsv',
    ]);
    exportService.exportLeads.and.returnValue(
      of(new Blob(['lead_id\n1\n'], { type: 'text/csv' })),
    );
    leadService.getLeads.and.returnValue(
      of({
        total: 1,
        items: [
          {
            id: 12,
            inquiry_type: 'showing',
            status: 'New',
            requester_user_id: null,
            contact_name: 'Taylor Morgan',
            contact_email: 'taylor@example.com',
            contact_phone: null,
            listing_id: 5,
            listing_title: '123 Main Street',
            message: null,
            preferred_at: null,
            source: 'public_listing',
            assigned_agent_id: null,
            assigned_user_id: null,
            assigned_to_label: null,
            created_at: '2026-09-22T00:00:00Z',
            updated_at: '2026-09-22T00:00:00Z',
            activities: [],
          },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        provideRouter([]),
        { provide: LeadService, useValue: leadService },
        { provide: ExportService, useValue: exportService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load newest lead data', () => {
    expect(leadService.getLeads).toHaveBeenCalledWith({});
    expect(component.total).toBe(1);
    expect(component.leads[0].contact_name).toBe('Taylor Morgan');
  });

  it('should export the same active filters shown in the lead list', () => {
    component.searchTerm = 'Taylor';
    component.statusFilter = 'New';
    component.typeFilter = 'showing';

    component.exportCsv();

    expect(exportService.exportLeads).toHaveBeenCalledWith({
      status: 'New',
      inquiry_type: 'showing',
      q: 'Taylor',
    });
    expect(exportService.saveCsv).toHaveBeenCalled();
  });

  it('should apply search, status, and type filters together', () => {
    component.searchTerm = 'Taylor';
    component.statusFilter = 'New';
    component.typeFilter = 'showing';

    component.loadLeads();

    expect(leadService.getLeads).toHaveBeenCalledWith({
      status: 'New',
      inquiry_type: 'showing',
      q: 'Taylor',
    });
  });
});
