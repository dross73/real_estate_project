import { PublicListing } from './public-listing';

export interface FavoriteState {
  listing_id: number;
  is_favorite: boolean;
}

export interface ListingCollection {
  items: PublicListing[];
}
