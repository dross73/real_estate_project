import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ListingPhotoTransferService {
  private pendingListingId: number | null = null;
  private pendingFiles: File[] = [];

  // Preserve the ordered create-listing photo queue across navigation to Edit Listing.
  stage(listingId: number, files: File[]): void {
    this.pendingListingId = listingId;
    this.pendingFiles = [...files];
  }

  // Hand the staged files to the matching Edit Listing photo uploader exactly once.
  take(listingId: number): File[] {
    if (this.pendingListingId !== listingId) {
      return [];
    }

    const files = [...this.pendingFiles];
    this.clear();
    return files;
  }

  clear(): void {
    this.pendingListingId = null;
    this.pendingFiles = [];
  }
}
