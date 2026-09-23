import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(UserService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should load the admin user directory', () => {
    service.getUsers().subscribe();

    const request = httpController.expectOne('http://localhost:8000/users/');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('should load one user by ID', () => {
    service.getUserById(7).subscribe();

    const request = httpController.expectOne('http://localhost:8000/users/7');
    expect(request.request.method).toBe('GET');
    request.flush({
      id: 7,
      email: 'staff@example.com',
      full_name: 'Staff User',
      is_active: true,
      archived_at: null,
      role: 'staff',
    });
  });

  it('should create and update users with the supplied payloads', () => {
    const createPayload = {
      email: 'new@example.com',
      password: 'Password123!',
      full_name: 'New Staff',
      is_active: true,
      role: 'staff' as const,
    };

    service.createUser(createPayload).subscribe();

    const create = httpController.expectOne('http://localhost:8000/users/');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(createPayload);
    create.flush({
      id: 8,
      email: createPayload.email,
      full_name: createPayload.full_name,
      is_active: true,
      archived_at: null,
      role: 'staff',
    });

    const updatePayload = {
      full_name: 'Updated Staff',
      is_active: false,
      role: 'staff' as const,
    };

    service.updateUser(8, updatePayload).subscribe();

    const update = httpController.expectOne('http://localhost:8000/users/8');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(updatePayload);
    update.flush({
      id: 8,
      email: createPayload.email,
      full_name: updatePayload.full_name,
      is_active: false,
      archived_at: null,
      role: 'staff',
    });
  });
});
