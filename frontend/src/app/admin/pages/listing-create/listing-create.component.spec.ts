import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ListingCreateComponent } from './listing-create.component';
import { AgentService } from '../../../services/agent.service';
import { ListingService } from '../../../services/listing.service';
import { OfficeService } from '../../../services/office.service';

describe('ListingCreateComponent', () => {
  let component: ListingCreateComponent;
  let fixture: ComponentFixture<ListingCreateComponent>;
  let listingService: jasmine.SpyObj<ListingService>;
  let agentService: jasmine.SpyObj<AgentService>;
  let officeService: jasmine.SpyObj<OfficeService>;

  beforeEach(async () => {
    agentService = jasmine.createSpyObj<AgentService>('AgentService', ['getAgents']);
    agentService.getAgents.and.returnValue(of([]));

    officeService = jasmine.createSpyObj<OfficeService>('OfficeService', [
      'getOffices',
    ]);
    officeService.getOffices.and.returnValue(of([]));

    listingService = jasmine.createSpyObj<ListingService>('ListingService', [
      'createListing',
    ]);

    await TestBed.configureTestingModule({
      imports: [ListingCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ListingService, useValue: listingService },
        { provide: AgentService, useValue: agentService },
        { provide: OfficeService, useValue: officeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default a new listing to the sole active office', () => {
    officeService.getOffices.and.returnValue(
      of([
        {
          id: 3,
          name: 'Story City Office',
          address_line1: '100 Broad St',
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

    component.ngOnInit();

    expect(component.listingForm.controls.office_id.value).toBe(3);
  });

  it('should keep Draft internal-only and enable visibility for Active', () => {
    expect(component.listingForm.controls.is_public.disabled).toBeTrue();
    expect(component.listingForm.controls.is_public.value).toBeFalse();

    component.listingForm.controls.status.setValue('Active');

    expect(component.listingForm.controls.is_public.enabled).toBeTrue();

    component.listingForm.controls.is_public.setValue(true);
    component.listingForm.controls.status.setValue('Archived');

    expect(component.listingForm.controls.is_public.disabled).toBeTrue();
    expect(component.listingForm.controls.is_public.value).toBeFalse();
  });
});
