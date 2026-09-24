// Service responsible for communication with the FastAPI users endpoint.
// Keeping API calls here prevents the component from handling backend request details.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { apiUrl } from '../core/api-base-url';

import { User, UserCreate, UserUpdate } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  // Shared base URL for the configured FastAPI backend
  private readonly apiBaseUrl = apiUrl();

  // Full users endpoint built from the base API URL
  private readonly apiUrl = `${this.apiBaseUrl}/users`;

  constructor(private http: HttpClient) {}

  // Fetches all users from the backend
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/`);
  }

  // Fetches one user by ID for the edit from
  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  // Creates a new user through the backend
  createUser(user: UserCreate): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/`, user);
  }

  // Updates an existing user through the backend
  updateUser(id: number, user: UserUpdate): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }
}
