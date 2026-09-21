import { PropertyType } from '../../models/listing';

export type PublicListingStatus = 'Active' | 'Pending' | 'Sold';

// Public-safe listing shape returned by /public/listings endpoints.
export interface PublicListing {
  id: number;
  title: string;
  status: PublicListingStatus;
  is_featured: boolean;
  hide_exact_address: boolean;

  price: number;
  property_type: PropertyType | null;

  address: string | null;
  city: string;
  state: string;

  description: string | null;
  sqft: number | null;
  acreage: number | null;
  year_built: number | null;

  bedrooms: number;
  bathrooms: number;

  school_district: string | null;
  amenities: string[];

  mls_number: string | null;
  source_attribution: string | null;
  cover_image: string | null;

  created_at: string | null;
  updated_at: string | null;
}
