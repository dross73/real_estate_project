import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AgentService } from '../../../services/agent.service';
import { OfficeService } from '../../../services/office.service';
import { AgentFormComponent } from './agent-form.component';

describe('AgentFormComponent', () => {
  let fixture: ComponentFixture<AgentFormComponent>;
  let component: AgentFormComponent;
  let agentService: jasmine.SpyObj<AgentService>;
  let officeService: jasmine.SpyObj<OfficeService>;

  beforeEach(async () => {
    agentService = jasmine.createSpyObj<AgentService>('AgentService', [
      'getAgent',
      'createAgent',
      'updateAgent',
    ]);
    officeService = jasmine.createSpyObj<OfficeService>('OfficeService', [
      'getOffices',
    ]);
    officeService.getOffices.and.returnValue(
      of([
        {
          id: 4,
          name: 'Story City Office',
          address_line1: '100 Broad Street',
          city: 'Story City',
          state: 'IA',
          postal_code: '50248',
          phone: null,
          email: null,
          hours: null,
          is_active: true,
          is_public: true,
          created_at: '2026-09-22T00:00:00Z',
          updated_at: '2026-09-22T00:00:00Z',
        },
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [AgentFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: AgentService, useValue: agentService },
        { provide: OfficeService, useValue: officeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should default a new agent to the sole active office', () => {
    expect(officeService.getOffices).toHaveBeenCalledWith(true);
    expect(component.form.controls.office_id.value).toBe(4);
  });
});
