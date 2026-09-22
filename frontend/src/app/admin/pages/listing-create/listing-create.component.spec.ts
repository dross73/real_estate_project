import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ListingCreateComponent } from './listing-create.component';
import { AgentService } from '../../../services/agent.service';
import { ListingService } from '../../../services/listing.service';

describe('ListingCreateComponent', () => {
  let component: ListingCreateComponent;
  let fixture: ComponentFixture<ListingCreateComponent>;
  let listingService: jasmine.SpyObj<ListingService>;
  let agentService: jasmine.SpyObj<AgentService>;

  beforeEach(async () => {
    agentService = jasmine.createSpyObj<AgentService>('AgentService', ['getAgents']);
    agentService.getAgents.and.returnValue(of([]));

    listingService = jasmine.createSpyObj<ListingService>('ListingService', [
      'createListing',
    ]);

    await TestBed.configureTestingModule({
      imports: [ListingCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ListingService, useValue: listingService },
        { provide: AgentService, useValue: agentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
