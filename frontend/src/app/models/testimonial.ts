export type TestimonialStatus = 'Pending' | 'Approved' | 'Rejected';
export type TestimonialSource = 'internal' | 'public';

export interface Testimonial {
  id: number;
  author_user_id: number | null;
  author_name: string;
  body: string;
  rating: number | null;
  source: TestimonialSource;
  status: TestimonialStatus;
  moderated_by_email: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestimonialCreate {
  author_name: string;
  body: string;
  rating: number | null;
  status: TestimonialStatus;
}

export interface TestimonialUpdate {
  author_name?: string;
  body?: string;
  rating?: number | null;
  status?: TestimonialStatus;
}

export interface PublicTestimonial {
  id: number;
  author_name: string;
  body: string;
  rating: number | null;
  created_at: string;
}

export interface PublicTestimonialCreate {
  body: string;
  rating: number | null;
}
