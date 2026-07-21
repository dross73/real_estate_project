// Service responsible for communication with the FastAPI users endpoint.
// Keeping API calls here prevents the component from handling backend request details.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { User, UserCreate } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  // Shared base URL for the local FastAPI backend
  private readonly apiBaseUrl = 'http://localhost:8000';

  // Full users endpoint built from the base API URL
  private readonly apiUrl = `${this.apiBaseUrl}/users`;

  constructor(private http: HttpClient) {}

  // Fetches all users from the backend
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/`);
  }

  // Creates a new user through the backend
  createUser(user: UserCreate): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/`, user);
  }
}
