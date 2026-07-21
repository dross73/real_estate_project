// Defines the TypeScript shape of user data returned by the FastApi backend
// This keeps the admin users page aligned with the backend response fields

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: string;
}

// Represents the data sent to POST /users/
export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  is_active: boolean;
  role: string;
}
