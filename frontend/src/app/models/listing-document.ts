// Downloadable PDF metadata used by admin and public listing pages.

export interface PublicListingDocument {
  id: number;
  title: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  download_url: string;
}

export interface ListingDocument extends PublicListingDocument {
  listing_id: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingDocumentUpdate {
  title?: string;
  is_public?: boolean;
}
