// Credentials entered on an authentication form
export interface LoginCredentials {
  email: string;
  password: string;
}

export type LoginStatus =
  | 'authenticated'
  | 'mfa_required'
  | 'mfa_enrollment_required';

// Login can either finish authentication or return a short-lived MFA challenge.
export interface AuthTokenResponse {
  status: LoginStatus;
  access_token: string | null;
  token_type: string | null;
  challenge_token: string | null;
}

export interface MfaEnrollmentStartResponse {
  secret: string;
  provisioning_uri: string;
  enrollment_token: string;
}

export interface MfaEnrollmentCompleteResponse {
  recovery_codes: string[];
  access_token: string | null;
  token_type: string | null;
}

export interface MfaStatusResponse {
  enabled: boolean;
  required: boolean;
  enrolled_at: string | null;
  recovery_codes_remaining: number;
}

// Fixed roles supported by the current application
export type UserRole = 'admin' | 'staff' | 'public_user';

// Claims read from the JWT returned by FastAPI
export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  exp: number;
}


// Safe public-account profile returned by the authenticated account API.
export interface PublicAccount {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  archived_at: string | null;
  role: 'public_user';
}

export interface PublicAccountUpdate {
  full_name?: string | null;
  phone?: string | null;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
}

export interface MessageResponse {
  message: string;
}
