// Credentials entered on an authentication form
export interface LoginCredentials {
  email: string;
  password: string;
}

// Token response returned by the FastAPI login endpoint
export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

// Fixed roles supported by the current application
export type UserRole = 'admin' | 'staff' | 'public_user';

// Claims read from the JWT returned by FastAPI
export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  exp: number;
}
