import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  HttpErrorResponse,
  HttpEventType,
  HttpResponse,
} from '@angular/common/http';
import { finalize, forkJoin } from 'rxjs';

import {
  ListingPhoto,
  ListingPhotoUploadSettings,
} from '../../../models/listing-photo';
import { ListingPhotoService } from '../../../services/listing-photo.service';
import { ListingPhotoTransferService } from '../../../services/listing-photo-transfer.service';

type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

interface PhotoUploadQueueItem {
  id: number;
  file: File;
  status: UploadStatus;
  progress: number;
  errorMessage: string;
  retryable: boolean;
}

@Component({
  selector: 'app-listing-photo-upload',
  imports: [CommonModule],
  templateUrl: './listing-photo-upload.component.html',
  styleUrl: './listing-photo-upload.component.css',
})
export class ListingPhotoUploadComponent implements OnInit {
  @Input() listingId: number | null = null;
  @Input() deferUploads = false;
  @Input() embedded = false;
  @Output() draftFilesChange = new EventEmitter<File[]>();

  readonly maxConcurrentUploads = 3;

  photos: ListingPhoto[] = [];
  uploadQueue: PhotoUploadQueueItem[] = [];
  settings: ListingPhotoUploadSettings | null = null;

  isLoading = true;
  loadError = false;
  isDragActive = false;
  isReordering = false;
  managementError = '';

  private activeUploads = 0;
  private nextQueueItemId = 1;
  private readonly busyPhotoIds = new Set<number>();
  private readonly photoErrors = new Map<number, string>();

  constructor(
    private readonly listingPhotoService: ListingPhotoService,
    private readonly photoTransferService: ListingPhotoTransferService,
  ) {}

  ngOnInit(): void {
    this.loadUploadContext();
  }

  get maxPhotos(): number {
    return this.settings?.max_photos ?? 50;
  }

  get maxFileBytes(): number {
    return this.settings?.max_file_bytes ?? 75 * 1024 * 1024;
  }

  get usedPhotoCount(): number {
    return this.photos.length;
  }

  get pendingPhotoCount(): number {
    return this.uploadQueue.filter(
      (item) => item.status === 'queued' || item.status === 'uploading',
    ).length;
  }

  get remainingSlots(): number {
    return Math.max(
      0,
      this.maxPhotos - this.usedPhotoCount - this.pendingPhotoCount,
    );
  }

  get acceptAttribute(): string {
    return (this.settings?.accepted_extensions ?? [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.heic',
      '.heif',
    ]).join(',');
  }

  get uploadSummary(): string {
    const uploading = this.uploadQueue.filter(
      (item) => item.status === 'uploading',
    ).length;
    const queued = this.uploadQueue.filter(
      (item) => item.status === 'queued',
    ).length;
    const failed = this.uploadQueue.filter(
      (item) => item.status === 'error',
    ).length;

    if (uploading === 0 && queued === 0 && failed === 0) {
      return 'No uploads in progress.';
    }

    return `${uploading} uploading, ${queued} queued, ${failed} failed.`;
  }

  loadUploadContext(): void {
    this.isLoading = true;
    this.loadError = false;
    this.managementError = '';

    // New listings can load upload rules before a database ID exists.
    if (!this.listingId) {
      this.listingPhotoService
        .getUploadSettings()
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: (settings) => {
            this.settings = settings;
            this.photos = [];
          },
          error: () => {
            this.loadError = true;
          },
        });
      return;
    }

    forkJoin({
      settings: this.listingPhotoService.getUploadSettings(),
      photos: this.listingPhotoService.getPhotos(this.listingId),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ settings, photos }) => {
          this.settings = settings;
          this.photos = this.sortPhotos(photos);

          // Continue any photos selected on Create Listing after navigation.
          const stagedFiles = this.photoTransferService.take(this.listingId!);
          if (stagedFiles.length > 0) {
            this.addFiles(stagedFiles);
          }
        },
        error: () => {
          this.loadError = true;
        },
      });
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    this.addFiles(files);

    // Allow selecting the same file again after a failure or dismissal.
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;

    const files = event.dataTransfer?.files
      ? Array.from(event.dataTransfer.files)
      : [];

    this.addFiles(files);
  }

  retryUpload(item: PhotoUploadQueueItem): void {
    if (item.status !== 'error' || !item.retryable) {
      return;
    }

    if (this.remainingSlots <= 0) {
      item.errorMessage = 'The listing has reached its configured photo limit.';
      item.retryable = false;
      return;
    }

    item.status = 'queued';
    item.progress = 0;
    item.errorMessage = '';
    this.pumpQueue();
  }

  dismissQueueItem(item: PhotoUploadQueueItem): void {
    if (item.status === 'uploading') {
      return;
    }

    if (item.status === 'queued' && !this.deferUploads) {
      return;
    }

    this.uploadQueue = this.uploadQueue.filter(
      (candidate) => candidate.id !== item.id,
    );
    this.emitDraftFiles();
  }

  moveQueueItem(item: PhotoUploadQueueItem, direction: -1 | 1): void {
    if (!this.deferUploads || item.status !== 'queued') {
      return;
    }

    // Coding exercise: reorder the selected photo within uploadQueue while
    // respecting the beginning/end boundaries, then emit the new draft order.
  }

  movePhoto(photo: ListingPhoto, direction: -1 | 1): void {
    if (this.isReordering) {
      return;
    }

    const currentIndex = this.photos.findIndex(
      (candidate) => candidate.id === photo.id,
    );
    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= this.photos.length
    ) {
      return;
    }

    const reordered = [...this.photos];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    this.isReordering = true;
    this.managementError = '';

    this.listingPhotoService
      .reorderPhotos(
        this.listingId,
        reordered.map((candidate) => candidate.id),
      )
      .pipe(finalize(() => (this.isReordering = false)))
      .subscribe({
        next: (photos) => {
          this.photos = this.sortPhotos(photos);
        },
        error: (error: HttpErrorResponse) => {
          this.managementError = this.apiErrorMessage(
            error,
            'Unable to reorder listing photos.',
          );
        },
      });
  }

  setPrimaryPhoto(photo: ListingPhoto): void {
    if (photo.is_primary || this.isPhotoBusy(photo.id)) {
      return;
    }

    this.beginPhotoAction(photo.id);

    this.listingPhotoService
      .setPrimaryPhoto(this.listingId, photo.id)
      .pipe(finalize(() => this.endPhotoAction(photo.id)))
      .subscribe({
        next: (updated) => {
          this.photos = this.photos.map((candidate) => ({
            ...candidate,
            is_primary: candidate.id === updated.id,
          }));
        },
        error: (error: HttpErrorResponse) => {
          this.setPhotoError(
            photo.id,
            this.apiErrorMessage(error, 'Unable to set the primary photo.'),
          );
        },
      });
  }

  deletePhoto(photo: ListingPhoto): void {
    if (this.isPhotoBusy(photo.id)) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${photo.original_filename}"? This removes the stored photo from the listing.`,
    );

    if (!confirmed) {
      return;
    }

    this.beginPhotoAction(photo.id);

    this.listingPhotoService
      .deletePhoto(this.listingId, photo.id)
      .pipe(finalize(() => this.endPhotoAction(photo.id)))
      .subscribe({
        next: () => {
          const remaining = this.photos
            .filter((candidate) => candidate.id !== photo.id)
            .map((candidate, position) => ({
              ...candidate,
              position,
              is_primary: photo.is_primary
                ? position === 0
                : candidate.is_primary,
            }));
          this.photos = remaining;
        },
        error: (error: HttpErrorResponse) => {
          this.setPhotoError(
            photo.id,
            this.apiErrorMessage(error, 'Unable to delete the listing photo.'),
          );
        },
      });
  }

  onReplacementInput(photo: ListingPhoto, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file || this.isPhotoBusy(photo.id)) {
      return;
    }

    const validationMessage = this.validateFile(file);
    if (validationMessage) {
      this.setPhotoError(photo.id, validationMessage);
      return;
    }

    this.beginPhotoAction(photo.id);

    this.listingPhotoService
      .replacePhoto(this.listingId, photo.id, file)
      .pipe(finalize(() => this.endPhotoAction(photo.id)))
      .subscribe({
        next: (updated) => {
          this.photos = this.photos.map((candidate) =>
            candidate.id === updated.id ? updated : candidate,
          );
        },
        error: (error: HttpErrorResponse) => {
          this.setPhotoError(
            photo.id,
            this.apiErrorMessage(error, 'Unable to replace the listing photo.'),
          );
        },
      });
  }

  isPhotoBusy(photoId: number): boolean {
    return this.busyPhotoIds.has(photoId);
  }

  photoError(photoId: number): string {
    return this.photoErrors.get(photoId) ?? '';
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  trackQueueItem(_index: number, item: PhotoUploadQueueItem): number {
    return item.id;
  }

  trackPhoto(_index: number, photo: ListingPhoto): number {
    return photo.id;
  }

  private addFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    let remaining = this.remainingSlots;

    for (const file of files) {
      const validationMessage = this.validateFile(file);

      if (validationMessage) {
        this.uploadQueue.push(
          this.createQueueItem(file, 'error', validationMessage, false),
        );
        continue;
      }

      if (remaining <= 0) {
        this.uploadQueue.push(
          this.createQueueItem(
            file,
            'error',
            `Photo limit reached. This listing allows up to ${this.maxPhotos} photos.`,
            false,
          ),
        );
        continue;
      }

      this.uploadQueue.push(this.createQueueItem(file, 'queued', '', true));
      remaining -= 1;
    }

    if (this.deferUploads) {
      this.emitDraftFiles();
    } else {
      this.pumpQueue();
    }
  }

  private createQueueItem(
    file: File,
    status: UploadStatus,
    errorMessage: string,
    retryable: boolean,
  ): PhotoUploadQueueItem {
    return {
      id: this.nextQueueItemId++,
      file,
      status,
      progress: 0,
      errorMessage,
      retryable,
    };
  }

  private validateFile(file: File): string {
    const extension = this.fileExtension(file.name);
    const acceptedExtensions = (
      this.settings?.accepted_extensions ?? [
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.heic',
        '.heif',
      ]
    ).map((value) => value.toLowerCase());

    if (!acceptedExtensions.includes(extension)) {
      return 'Unsupported image type. Use JPEG, PNG, WebP, HEIC, or HEIF.';
    }

    if (file.size > this.maxFileBytes) {
      return `File is too large. Maximum size is ${this.formatBytes(this.maxFileBytes)}.`;
    }

    return '';
  }

  private fileExtension(filename: string): string {
    const finalDot = filename.lastIndexOf('.');
    return finalDot >= 0 ? filename.slice(finalDot).toLowerCase() : '';
  }

  private pumpQueue(): void {
    if (this.deferUploads || !this.listingId) {
      return;
    }

    while (this.activeUploads < this.maxConcurrentUploads) {
      const nextItem = this.uploadQueue.find(
        (item) => item.status === 'queued',
      );

      if (!nextItem) {
        return;
      }

      this.startUpload(nextItem);
    }
  }

  private startUpload(item: PhotoUploadQueueItem): void {
    if (!this.listingId) {
      return;
    }

    item.status = 'uploading';
    item.progress = 0;
    item.errorMessage = '';
    this.activeUploads += 1;

    this.listingPhotoService
      .uploadPhoto(this.listingId, item.file)
      .pipe(
        finalize(() => {
          this.activeUploads -= 1;
          this.pumpQueue();
        }),
      )
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            item.progress = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : item.progress;
            return;
          }

          if (event instanceof HttpResponse && event.body) {
            item.status = 'success';
            item.progress = 100;
            item.retryable = false;
            this.photos = this.sortPhotos([...this.photos, event.body]);
          }
        },
        error: (error: HttpErrorResponse) => {
          item.status = 'error';
          item.progress = 0;
          item.errorMessage = this.apiErrorMessage(
            error,
            'Upload failed. Try this photo again.',
          );
          item.retryable = error.status !== 400 && error.status !== 409;
        },
      });
  }

  private emitDraftFiles(): void {
    if (!this.deferUploads) {
      return;
    }

    const files = this.uploadQueue
      .filter((item) => item.status === 'queued')
      .map((item) => item.file);

    this.draftFilesChange.emit(files);
  }

  private sortPhotos(photos: ListingPhoto[]): ListingPhoto[] {
    return [...photos].sort(
      (left, right) => left.position - right.position || left.id - right.id,
    );
  }

  private beginPhotoAction(photoId: number): void {
    this.photoErrors.delete(photoId);
    this.busyPhotoIds.add(photoId);
  }

  private endPhotoAction(photoId: number): void {
    this.busyPhotoIds.delete(photoId);
  }

  private setPhotoError(photoId: number, message: string): void {
    this.photoErrors.set(photoId, message);
  }

  private apiErrorMessage(
    error: HttpErrorResponse,
    fallback: string,
  ): string {
    const detail = error.error?.detail;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (error.status === 0) {
      return 'The server could not be reached. Please try again.';
    }

    return fallback;
  }
}
