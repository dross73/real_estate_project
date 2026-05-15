// Defines the TypeScript shape of listing data returned by the FastAPI backend.
// These interfaces help Angular catch field-name and response-shape mistakes while coding.

// Represents one real estate listing returned by the FastAPI backend
export interface Listing {
  id: number;
  title: string;
  status: string;
  price: number;
  address: string;
  city: string;
  state: string;
  description: string | null;
  sqft: number | null;
  bedrooms: number;
  bathrooms: number;
  cover_image: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Represents the paginated response returned by GET /listings
export interface PaginatedListingsResponse {
  items: Listing[]; // Array of listing items for the current page
  total: number; // Total number of listings across all pages
  page: number; // Current page number
  per_page: number; // Number of items per page
}
