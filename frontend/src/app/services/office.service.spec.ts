import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OfficeService } from './office.service';

describe('OfficeService', () => {
  let service: OfficeService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(OfficeService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should load active offices for assignment', () => {
    service.getOffices(true).subscribe();

    const request = httpController.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8000/offices' &&
        candidate.params.get('active_only') === 'true',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('should create and update offices through admin endpoints', () => {
    const payload = {
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
    };

    service.createOffice(payload).subscribe();
    const create = httpController.expectOne('http://localhost:8000/offices');
    expect(create.request.method).toBe('POST');
    create.flush({
      id: 1,
      ...payload,
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    });

    service.updateOffice(1, { phone: '515-555-0100' }).subscribe();
    const update = httpController.expectOne('http://localhost:8000/offices/1');
    expect(update.request.method).toBe('PUT');
    update.flush({
      id: 1,
      ...payload,
      phone: '515-555-0100',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    });
  });
});
