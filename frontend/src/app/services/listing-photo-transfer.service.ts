import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
// Temporarily carries selected create-listing photos across the route change to Edit Listing.
export class ListingPhotoTransferService {
  // Tie the staged files to one newly created listing so another route cannot consume them.
  private pendingListingId: number | null = null;

  // Preserve the user's selected photo order until the Edit Listing uploader takes over.
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

  // Remove any staged photo handoff after it is consumed or no photos were selected.
  clear(): void {
    this.pendingListingId = null;
    this.pendingFiles = [];
  }
}
