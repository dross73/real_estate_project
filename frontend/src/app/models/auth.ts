// Credentials entered on the admin login form
export interface LoginCredentials {
  email: string;
  password: string;
}

// Token response returned by the FastAPI login endpoint
export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

// Roles supported by the admin application
export type UserRole = 'admin' | 'staff';

// Claims read from the JWT returned by FastAPI
export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  exp: number;
}