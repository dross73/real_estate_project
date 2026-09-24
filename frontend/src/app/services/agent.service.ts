import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../core/api-base-url';

import {
  AgentProfile,
  AgentProfileCreate,
  AgentProfileUpdate,
  PublicAgentProfile,
} from '../models/agent';

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly apiBaseUrl = apiUrl();
  private readonly adminUrl = `${this.apiBaseUrl}/agents`;
  private readonly publicUrl = `${this.apiBaseUrl}/public/agents`;

  constructor(private readonly http: HttpClient) {}

  getAgents(activeOnly = false): Observable<AgentProfile[]> {
    return this.http.get<AgentProfile[]>(this.adminUrl, {
      params: { active_only: activeOnly },
    });
  }

  getAgent(id: number): Observable<AgentProfile> {
    return this.http.get<AgentProfile>(`${this.adminUrl}/${id}`);
  }

  createAgent(payload: AgentProfileCreate): Observable<AgentProfile> {
    return this.http.post<AgentProfile>(this.adminUrl, payload);
  }

  updateAgent(
    id: number,
    payload: AgentProfileUpdate,
  ): Observable<AgentProfile> {
    return this.http.put<AgentProfile>(`${this.adminUrl}/${id}`, payload);
  }

  deleteAgent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }

  getPublicAgent(id: number): Observable<PublicAgentProfile> {
    return this.http.get<PublicAgentProfile>(`${this.publicUrl}/${id}`);
  }
}
