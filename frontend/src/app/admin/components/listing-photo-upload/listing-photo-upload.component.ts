import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
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

// Represents the possible states of one photo in the upload queue.
type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

// Stores one selected photo and tracks its upload state.
interface PhotoUploadQueueItem {
  id: number;
  file: File;
  status: UploadStatus;
  progress: number;
  errorMessage: string;
  retryable: boolean;
  uploadedPhotoId: number | null;
}

@Component({
  selector: 'app-listing-photo-upload',
  imports: [CommonModule],
  templateUrl: './listing-photo-upload.component.html',
  styleUrl: './listing-photo-upload.component.css',
})
export class ListingPhotoUploadComponent implements OnInit {
  // Identifies the existing listing whose photos are being managed.
  @Input() listingId: number | null = null;

  // Keeps selected photos queued until a new listing has been created.
  @Input() deferUploads = false;

  // Removes the outer card styling when this component is shown inside another form.
  @Input() embedded = false;

  // Sends the ordered list of queued photos back to the parent Create Listing component.
  @Output() draftFilesChange = new EventEmitter<File[]>();

  // Limits how many photos can upload at the same time.
  readonly maxConcurrentUploads = 3;

  // Stores the photos that have already been uploaded for this listing.
  photos: ListingPhoto[] = [];

  // Stores selected photos that are waiting, uploading, completed, or failed.
  uploadQueue: PhotoUploadQueueItem[] = [];

  // Stores upload limits and accepted file types returned by the backend.
  settings: ListingPhotoUploadSettings | null = null;

  // Tracks loading and interaction state used by the template.
  isLoading = true;
  loadError = false;
  isDragActive = false;
  isReordering = false;
  managementError = '';

  // Tracks active work and per-photo state without exposing it to the template directly.
  private activeUploads = 0;
  private nextQueueItemId = 1;

  // Preserve the user's Create Listing queue order until the staged batch settles.
  private preserveDeferredQueueOrder = false;

  private readonly busyPhotoIds = new Set<number>();
  private readonly photoErrors = new Map<number, string>();

  // Inject the API service and the temporary create-to-edit photo transfer service.
  constructor(
    private readonly listingPhotoService: ListingPhotoService,
    private readonly photoTransferService: ListingPhotoTransferService,
  ) {}

  // Load the upload rules and any existing listing photos when the component starts.
  ngOnInit(): void {
    this.loadUploadContext();
  }

  // Return the backend photo limit, with a safe fallback before settings load.
  get maxPhotos(): number {
    return this.settings?.max_photos ?? 50;
  }

  // Return the backend file-size limit, with a safe fallback before settings load.
  get maxFileBytes(): number {
    return this.settings?.max_file_bytes ?? 75 * 1024 * 1024;
  }

  // Count photos that are already stored for the listing.
  get usedPhotoCount(): number {
    return this.photos.length;
  }

  // Count photos that still occupy a slot because they are queued or uploading.
  get pendingPhotoCount(): number {
    return this.uploadQueue.filter(
      (item) => item.status === 'queued' || item.status === 'uploading',
    ).length;
  }

  // Calculate how many more valid photos can be accepted.
  get remainingSlots(): number {
    return Math.max(
      0,
      this.maxPhotos - this.usedPhotoCount - this.pendingPhotoCount,
    );
  }

  // Build the file-input accept value from the backend-supported extensions.
  get acceptAttribute(): string {
    return (
      this.settings?.accepted_extensions ?? [
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.heic',
        '.heif',
      ]
    ).join(',');
  }

  // Build the short accessibility status announced while uploads are running.
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

  // Load upload settings and, when a listing already exists, its stored gallery.
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

    // Existing listings need both the upload rules and the current gallery before rendering.
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
            this.preserveDeferredQueueOrder = true;
            this.addFiles(stagedFiles);
          }
        },
        error: () => {
          this.loadError = true;
        },
      });
  }

  // Add photos selected through the hidden file input.
  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    this.addFiles(files);

    // Allow selecting the same file again after a failure or dismissal.
    input.value = '';
  }

  // Keep the browser from opening the dragged file and show the active drop-zone state.
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = true;
  }

  // Clear the drop-zone highlight when the pointer leaves the target.
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
  }

  // Add every file dropped onto the photo drop zone.
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;

    const files = event.dataTransfer?.files
      ? Array.from(event.dataTransfer.files)
      : [];

    this.addFiles(files);
  }

  // Return a failed, retryable photo to the queue when capacity is available.
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

  // Remove a completed, failed, or deferred queue item from the visible queue.
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

  // Move a deferred create-listing photo one position earlier or later.
  moveQueueItem(item: PhotoUploadQueueItem, direction: -1 | 1): void {
    if (!this.deferUploads || item.status !== 'queued') {
      return;
    }
    const currentIndex = this.uploadQueue.findIndex(
      (candidate) => candidate.id === item.id,
    );
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= this.uploadQueue.length) {
      return;
    }

    // Reorder a copy so the queue gets a new array reference for Angular change detection.
    const reordered = [...this.uploadQueue];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    this.uploadQueue = reordered;
    this.emitDraftFiles();
  }

  // Move an already-uploaded photo and persist the complete gallery order.
  movePhoto(photo: ListingPhoto, direction: -1 | 1): void {
    const listingId = this.listingId;
    if (!listingId || this.isReordering) {
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

    // Reorder a copy locally before sending the new ID sequence to the backend.
    const reordered = [...this.photos];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    this.isReordering = true;
    this.managementError = '';

    this.listingPhotoService
      .reorderPhotos(
        listingId,
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

  // Make one stored photo the listing's primary image.
  setPrimaryPhoto(photo: ListingPhoto): void {
    const listingId = this.listingId;
    if (!listingId || photo.is_primary || this.isPhotoBusy(photo.id)) {
      return;
    }

    this.beginPhotoAction(photo.id);

    this.listingPhotoService
      .setPrimaryPhoto(listingId, photo.id)
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

  // Confirm and permanently remove one stored photo from the listing.
  deletePhoto(photo: ListingPhoto): void {
    const listingId = this.listingId;
    if (!listingId || this.isPhotoBusy(photo.id)) {
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
      .deletePhoto(listingId, photo.id)
      .pipe(finalize(() => this.endPhotoAction(photo.id)))
      .subscribe({
        next: () => {
          // Rebuild local positions and promote the first remaining photo if the primary was deleted.
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

  // Validate and replace one stored photo while preserving its gallery position.
  onReplacementInput(photo: ListingPhoto, event: Event): void {
    const listingId = this.listingId;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!listingId || !file || this.isPhotoBusy(photo.id)) {
      return;
    }

    const validationMessage = this.validateFile(file);
    if (validationMessage) {
      this.setPhotoError(photo.id, validationMessage);
      return;
    }

    this.beginPhotoAction(photo.id);

    this.listingPhotoService
      .replacePhoto(listingId, photo.id, file)
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

  // Report whether a stored photo currently has a management request in progress.
  isPhotoBusy(photoId: number): boolean {
    return this.busyPhotoIds.has(photoId);
  }

  // Return the most recent management error for one stored photo.
  photoError(photoId: number): string {
    return this.photoErrors.get(photoId) ?? '';
  }

  // Format byte counts for readable upload-size guidance in the template.
  formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Give Angular a stable key when rendering upload-queue rows.
  trackQueueItem(_index: number, item: PhotoUploadQueueItem): number {
    return item.id;
  }

  // Give Angular a stable key when rendering stored gallery photos.
  trackPhoto(_index: number, photo: ListingPhoto): number {
    return photo.id;
  }

  // Validate newly selected files, add them to the queue, and start uploads when allowed.
  private addFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    // Track capacity locally so one large selection cannot exceed the listing limit.
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

    // Create Listing only reports the ordered files upward; Edit Listing can upload immediately.
    if (this.deferUploads) {
      this.emitDraftFiles();
    } else {
      this.pumpQueue();
    }
  }

  // Create a consistent queue record for valid selections and validation failures.
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
      uploadedPhotoId: null,
    };
  }

  // Validate one file against the backend-supported extension and size limits.
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

  // Return a lowercase extension so file-type checks are case-insensitive.
  private fileExtension(filename: string): string {
    const finalDot = filename.lastIndexOf('.');
    return finalDot >= 0 ? filename.slice(finalDot).toLowerCase() : '';
  }

  // Start queued uploads until the configured concurrency limit is reached.
  private pumpQueue(): void {
    if (this.deferUploads || !this.listingId) {
      return;
    }

    // Each completed request calls pumpQueue again, allowing the next queued item to start.
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

  // Upload one queued photo and keep its progress, success, or failure state in sync.
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
          // Free one concurrency slot and immediately check for the next queued photo.
          this.activeUploads -= 1;
          this.pumpQueue();

          // Once a staged create-listing batch settles, persist its selected order.
          this.persistDeferredQueueOrder();
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
            item.uploadedPhotoId = event.body.id;
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

  // Restore the Create Listing queue order after the staged upload batch settles.
  private persistDeferredQueueOrder(): void {
    const listingId = this.listingId;
    if (
      !this.preserveDeferredQueueOrder ||
      !listingId ||
      this.pendingPhotoCount > 0
    ) {
      return;
    }

    const queuedPhotoIds = this.uploadQueue
      .map((item) => item.uploadedPhotoId)
      .filter((photoId): photoId is number => photoId !== null);

    if (queuedPhotoIds.length === 0) {
      return;
    }

    const queuedIdSet = new Set(queuedPhotoIds);
    const remainingPhotoIds = this.photos
      .filter((photo) => !queuedIdSet.has(photo.id))
      .map((photo) => photo.id);
    const desiredPhotoIds = [...queuedPhotoIds, ...remainingPhotoIds];
    const currentPhotoIds = this.sortPhotos(this.photos).map(
      (photo) => photo.id,
    );
    const hasRetryableFailure = this.uploadQueue.some(
      (item) => item.status === 'error' && item.retryable,
    );

    // Skip the API call when completion order already matches the selected order.
    if (
      desiredPhotoIds.length === currentPhotoIds.length &&
      desiredPhotoIds.every(
        (photoId, index) => photoId === currentPhotoIds[index],
      )
    ) {
      if (!hasRetryableFailure) {
        this.preserveDeferredQueueOrder = false;
      }
      return;
    }

    this.isReordering = true;
    this.managementError = '';

    this.listingPhotoService
      .reorderPhotos(listingId, desiredPhotoIds)
      .pipe(finalize(() => (this.isReordering = false)))
      .subscribe({
        next: (photos) => {
          this.photos = this.sortPhotos(photos);

          if (!hasRetryableFailure) {
            this.preserveDeferredQueueOrder = false;
          }
        },
        error: (error: HttpErrorResponse) => {
          this.managementError = this.apiErrorMessage(
            error,
            'Photos uploaded, but the initial gallery order could not be saved.',
          );
        },
      });
  }

  // Send only valid queued files to Create Listing in their current display order.
  private emitDraftFiles(): void {
    if (!this.deferUploads) {
      return;
    }

    const files = this.uploadQueue
      .filter((item) => item.status === 'queued')
      .map((item) => item.file);

    this.draftFilesChange.emit(files);
  }

  // Keep the stored gallery ordered by backend position, using ID as a stable tiebreaker.
  private sortPhotos(photos: ListingPhoto[]): ListingPhoto[] {
    return [...photos].sort(
      (left, right) => left.position - right.position || left.id - right.id,
    );
  }

  // Mark one stored photo busy and clear any stale error before a management request.
  private beginPhotoAction(photoId: number): void {
    this.photoErrors.delete(photoId);
    this.busyPhotoIds.add(photoId);
  }

  // Release the stored photo after its management request finishes.
  private endPhotoAction(photoId: number): void {
    this.busyPhotoIds.delete(photoId);
  }

  // Store an error against the affected photo so other gallery items remain usable.
  private setPhotoError(photoId: number, message: string): void {
    this.photoErrors.set(photoId, message);
  }

  // Prefer a backend detail message, then fall back to a useful client-side message.
  private apiErrorMessage(error: HttpErrorResponse, fallback: string): string {
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
