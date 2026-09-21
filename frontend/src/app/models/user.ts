// Fixed roles returned by the FastAPI backend
export type UserRole = 'admin' | 'staff' | 'public_user';

// Defines the TypeScript shape of user data returned by the FastAPI backend
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  archived_at: string | null;
  role: UserRole;
}

// Represents data sent by the admin-only POST /users/ endpoint
export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  is_active: boolean;
  role: 'admin' | 'staff';
}

// Represents editable data sent to PUT /users/{user_id}
export interface UserUpdate {
  full_name: string;
  is_active: boolean;
  role: UserRole;
}
