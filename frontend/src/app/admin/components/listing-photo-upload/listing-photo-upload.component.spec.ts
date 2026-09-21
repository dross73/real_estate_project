import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { ListingPhoto } from '../../../models/listing-photo';
import { ListingPhotoService } from '../../../services/listing-photo.service';
import { ListingPhotoUploadComponent } from './listing-photo-upload.component';

describe('ListingPhotoUploadComponent', () => {
  let fixture: ComponentFixture<ListingPhotoUploadComponent>;
  let component: ListingPhotoUploadComponent;
  let photoService: jasmine.SpyObj<ListingPhotoService>;

  const storedPhoto: ListingPhoto = {
    id: 1,
    listing_id: 7,
    original_filename: 'existing.jpg',
    source_format: 'JPEG',
    width: 1600,
    height: 1000,
    position: 0,
    is_primary: true,
    thumbnail_url: 'https://media.example/existing-thumb.webp',
    medium_url: 'https://media.example/existing-medium.webp',
    large_url: 'https://media.example/existing-large.webp',
    created_at: '2026-09-21T00:00:00Z',
    updated_at: '2026-09-21T00:00:00Z',
  };

  beforeEach(async () => {
    photoService = jasmine.createSpyObj<ListingPhotoService>(
      'ListingPhotoService',
      [
        'getUploadSettings',
        'getPhotos',
        'uploadPhoto',
        'reorderPhotos',
        'setPrimaryPhoto',
        'deletePhoto',
        'replacePhoto',
      ],
    );

    photoService.getUploadSettings.and.returnValue(
      of({
        max_photos: 30,
        max_file_bytes: 10 * 1024 * 1024,
        accepted_extensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
      }),
    );
    photoService.getPhotos.and.returnValue(of([storedPhoto]));

    await TestBed.configureTestingModule({
      imports: [ListingPhotoUploadComponent],
      providers: [{ provide: ListingPhotoService, useValue: photoService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingPhotoUploadComponent);
    component = fixture.componentInstance;
    component.listingId = 7;
  });

  it('should load the configured limit and current gallery usage', () => {
    fixture.detectChanges();

    expect(component.maxPhotos).toBe(30);
    expect(component.usedPhotoCount).toBe(1);
    expect(component.remainingSlots).toBe(29);
  });

  it('should reject unsupported files before calling the upload API', () => {
    fixture.detectChanges();
    const input = document.createElement('input');
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });

    component.onFileInput({ target: input } as unknown as Event);

    expect(component.uploadQueue[0].status).toBe('error');
    expect(component.uploadQueue[0].retryable).toBeFalse();
    expect(photoService.uploadPhoto).not.toHaveBeenCalled();
  });

  it('should preserve successful uploads when another queued file fails', () => {
    fixture.detectChanges();

    const successPhoto = { ...storedPhoto, id: 2, position: 1, original_filename: 'one.jpg' };
    photoService.uploadPhoto.and.callFake((_listingId, file) => {
      if (file.name === 'one.jpg') {
        return of(new HttpResponse({ body: successPhoto }));
      }

      return throwError(
        () => new HttpErrorResponse({
          status: 503,
          error: { detail: 'Listing media storage is unavailable' },
        }),
      );
    });

    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [
        new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
        new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
      ],
    });

    component.onFileInput({ target: input } as unknown as Event);

    expect(component.photos.some((photo) => photo.id === 2)).toBeTrue();
    expect(component.uploadQueue.find((item) => item.file.name === 'one.jpg')?.status).toBe('success');
    expect(component.uploadQueue.find((item) => item.file.name === 'two.jpg')?.status).toBe('error');
  });

  it('should reorder photos through the management service', () => {
    const secondPhoto: ListingPhoto = {
      ...storedPhoto,
      id: 2,
      original_filename: 'second.jpg',
      position: 1,
      is_primary: false,
    };
    photoService.getPhotos.and.returnValue(of([storedPhoto, secondPhoto]));
    photoService.reorderPhotos.and.returnValue(
      of([
        { ...secondPhoto, position: 0 },
        { ...storedPhoto, position: 1 },
      ]),
    );
    fixture.detectChanges();

    component.movePhoto(secondPhoto, -1);

    expect(photoService.reorderPhotos).toHaveBeenCalledWith(7, [2, 1]);
    expect(component.photos.map((photo) => photo.id)).toEqual([2, 1]);
  });

  it('should select a primary photo independently from gallery order', () => {
    const secondPhoto: ListingPhoto = {
      ...storedPhoto,
      id: 2,
      original_filename: 'second.jpg',
      position: 1,
      is_primary: false,
    };
    photoService.getPhotos.and.returnValue(of([storedPhoto, secondPhoto]));
    photoService.setPrimaryPhoto.and.returnValue(
      of({ ...secondPhoto, is_primary: true }),
    );
    fixture.detectChanges();

    component.setPrimaryPhoto(secondPhoto);

    expect(photoService.setPrimaryPhoto).toHaveBeenCalledWith(7, 2);
    expect(component.photos[0].is_primary).toBeFalse();
    expect(component.photos[1].is_primary).toBeTrue();
  });

  it('should promote the first remaining photo locally after deleting the primary', () => {
    const secondPhoto: ListingPhoto = {
      ...storedPhoto,
      id: 2,
      original_filename: 'second.jpg',
      position: 1,
      is_primary: false,
    };
    photoService.getPhotos.and.returnValue(of([storedPhoto, secondPhoto]));
    photoService.deletePhoto.and.returnValue(of(void 0));
    spyOn(window, 'confirm').and.returnValue(true);
    fixture.detectChanges();

    component.deletePhoto(storedPhoto);

    expect(photoService.deletePhoto).toHaveBeenCalledWith(7, 1);
    expect(component.photos.length).toBe(1);
    expect(component.photos[0].id).toBe(2);
    expect(component.photos[0].position).toBe(0);
    expect(component.photos[0].is_primary).toBeTrue();
  });

  it('should replace a photo in place without changing its order or primary state', () => {
    const replacementPhoto: ListingPhoto = {
      ...storedPhoto,
      original_filename: 'replacement.jpg',
      thumbnail_url: 'https://media.example/new-thumb.webp',
      medium_url: 'https://media.example/new-medium.webp',
      large_url: 'https://media.example/new-large.webp',
    };
    photoService.replacePhoto.and.returnValue(of(replacementPhoto));
    fixture.detectChanges();

    const input = document.createElement('input');
    const replacementFile = new File(['replacement'], 'replacement.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(input, 'files', { value: [replacementFile] });

    component.onReplacementInput(
      storedPhoto,
      { target: input } as unknown as Event,
    );

    expect(photoService.replacePhoto).toHaveBeenCalledWith(
      7,
      1,
      replacementFile,
    );
    expect(component.photos[0].original_filename).toBe('replacement.jpg');
    expect(component.photos[0].position).toBe(0);
    expect(component.photos[0].is_primary).toBeTrue();
  });

  it('should limit simultaneous uploads to three', () => {
    fixture.detectChanges();

    const subjects = Array.from({ length: 4 }, () => new Subject<any>());
    let callIndex = 0;
    photoService.uploadPhoto.and.callFake(() => subjects[callIndex++].asObservable());

    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [
        new File(['1'], 'one.jpg'),
        new File(['2'], 'two.jpg'),
        new File(['3'], 'three.jpg'),
        new File(['4'], 'four.jpg'),
      ],
    });

    component.onFileInput({ target: input } as unknown as Event);

    expect(photoService.uploadPhoto).toHaveBeenCalledTimes(3);
    expect(component.uploadQueue.filter((item) => item.status === 'queued').length).toBe(1);

    subjects[0].next(new HttpResponse({ body: { ...storedPhoto, id: 10, position: 1 } }));
    subjects[0].complete();

    expect(photoService.uploadPhoto).toHaveBeenCalledTimes(4);
  });
});
