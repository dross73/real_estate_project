// Admin-managed brokerage/site settings returned by FastAPI.
export interface SiteSettings {
  site_name: string;
  site_descriptor: string | null;
  tagline: string | null;
  logo_url: string | null;

  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;

  homepage_eyebrow: string | null;
  homepage_title: string | null;
  homepage_intro: string | null;
  homepage_story_title: string | null;
  homepage_story_copy: string | null;

  primary_color: string;
  secondary_color: string;

  show_about: boolean;
  show_contact: boolean;
  show_testimonials: boolean;
  enable_testimonial_submissions: boolean;
  enable_contact_requests: boolean;
  enable_showing_requests: boolean;

  listing_photo_max_count: number;
  hard_listing_photo_max_count: number;

  updated_at: string | null;
}

export type SiteSettingsUpdate = Omit<
  SiteSettings,
  'hard_listing_photo_max_count' | 'updated_at'
>;
