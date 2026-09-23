import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OfficeService } from '../../../services/office.service';
import { OfficesComponent } from './offices.component';

describe('OfficesComponent', () => {
  let fixture: ComponentFixture<OfficesComponent>;
  let component: OfficesComponent;
  let officeService: jasmine.SpyObj<OfficeService>;

  const offices = [
    {
      id: 1,
      name: 'Story City Office',
      address_line1: '100 Broad Street',
      city: 'Story City',
      state: 'IA',
      postal_code: '50248',
      phone: null,
      email: 'story@example.com',
      hours: null,
      is_active: true,
      is_public: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Ames Office',
      address_line1: '200 Main Street',
      city: 'Ames',
      state: 'IA',
      postal_code: '50010',
      phone: null,
      email: 'ames@example.com',
      hours: null,
      is_active: true,
      is_public: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    officeService = jasmine.createSpyObj<OfficeService>('OfficeService', [
      'getOffices',
    ]);
    officeService.getOffices.and.returnValue(of(offices));

    await TestBed.configureTestingModule({
      imports: [OfficesComponent],
      providers: [
        provideRouter([]),
        { provide: OfficeService, useValue: officeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfficesComponent);
    component = fixture.componentInstance;
  });

  it('should load and filter the office directory', () => {
    fixture.detectChanges();

    expect(officeService.getOffices).toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();

    component.searchTerm = 'ames';

    expect(component.filteredOffices.map((office) => office.id)).toEqual([2]);
  });

  it('should expose a load error and stop the loading state', () => {
    officeService.getOffices.and.returnValue(
      throwError(() => new Error('offline')),
    );

    fixture.detectChanges();

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toBe('Unable to load offices.');
  });
});
