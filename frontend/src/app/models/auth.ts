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