import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ListingPhotoService } from './listing-photo.service';

describe('ListingPhotoService', () => {
  let service: ListingPhotoService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(ListingPhotoService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should load upload settings and listing photos', () => {
    service.getUploadSettings().subscribe();
    const settingsRequest = httpController.expectOne(
      'http://localhost:8000/listings/photo-upload-settings',
    );
    expect(settingsRequest.request.method).toBe('GET');
    settingsRequest.flush({
      max_photos: 30,
      max_file_bytes: 1000,
      accepted_extensions: ['.jpg'],
    });

    service.getPhotos(12).subscribe();
    const photosRequest = httpController.expectOne(
      'http://localhost:8000/listings/12/photos',
    );
    expect(photosRequest.request.method).toBe('GET');
    photosRequest.flush([]);
  });

  it('should upload one file as multipart form data with progress enabled', () => {
    const file = new File(['image'], 'front.jpg', { type: 'image/jpeg' });

    service.uploadPhoto(12, file).subscribe();

    const request = httpController.expectOne(
      'http://localhost:8000/listings/12/photos',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.reportProgress).toBeTrue();
    expect(request.request.body instanceof FormData).toBeTrue();
    expect((request.request.body as FormData).get('file')).toBe(file);

    request.flush({});
  });
});
