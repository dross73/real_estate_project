// Admin-facing listing photo types returned by the protected photo API.
export interface ListingPhoto {
  id: number;
  listing_id: number;
  original_filename: string;
  source_format: string;
  width: number;
  height: number;
  position: number;
  is_primary: boolean;
  thumbnail_url: string;
  medium_url: string;
  large_url: string;
  created_at: string;
  updated_at: string;
}

// Non-secret backend limits used for client-side upload guidance.
export interface ListingPhotoUploadSettings {
  max_photos: number;
  max_file_bytes: number;
  accepted_extensions: string[];
}
