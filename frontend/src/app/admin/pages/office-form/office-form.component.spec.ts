import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, throwError } from 'rxjs';

import { OfficeService } from '../../../services/office.service';
import { OfficeFormComponent } from './office-form.component';

describe('OfficeFormComponent', () => {
  let fixture: ComponentFixture<OfficeFormComponent>;
  let component: OfficeFormComponent;
  let officeService: jasmine.SpyObj<OfficeService>;
  let router: Router;

  beforeEach(async () => {
    officeService = jasmine.createSpyObj<OfficeService>('OfficeService', [
      'getOffice',
      'createOffice',
      'updateOffice',
    ]);
    officeService.createOffice.and.returnValue(
      of({
        id: 1,
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
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [OfficeFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
        { provide: OfficeService, useValue: officeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfficeFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  it('should block an invalid office form', () => {
    component.submit();

    expect(component.form.touched).toBeTrue();
    expect(officeService.createOffice).not.toHaveBeenCalled();
  });

  it('should normalize required fields and optional blanks before create', () => {
    component.form.setValue({
      name: '  Story City Office  ',
      address_line1: '  100 Broad Street  ',
      city: '  Story City  ',
      state: ' ia ',
      postal_code: ' 50248 ',
      phone: ' ',
      email: '',
      hours: ' ',
      is_active: true,
      is_public: true,
    });

    component.submit();

    expect(officeService.createOffice).toHaveBeenCalledWith({
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
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/offices']);
  });

  it('should show a save error and clear the submitting state', () => {
    officeService.createOffice.and.returnValue(
      throwError(() => new Error('offline')),
    );
    component.form.setValue({
      name: 'Story City Office',
      address_line1: '100 Broad Street',
      city: 'Story City',
      state: 'IA',
      postal_code: '50248',
      phone: '',
      email: '',
      hours: '',
      is_active: true,
      is_public: true,
    });

    component.submit();

    expect(component.errorMessage).toBe('Unable to save the office.');
    expect(component.isSubmitting).toBeFalse();
  });
});
