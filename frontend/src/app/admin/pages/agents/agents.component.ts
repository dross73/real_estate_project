import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AgentProfile } from '../../../models/agent';
import { AgentService } from '../../../services/agent.service';

@Component({
  selector: 'app-agents',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.css',
})
export class AgentsComponent implements OnInit {
  agents: AgentProfile[] = [];
  searchTerm = '';
  isLoading = true;
  errorMessage = '';

  constructor(private readonly agentService: AgentService) {}

  ngOnInit(): void {
    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents = agents;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load agent profiles.';
        this.isLoading = false;
      },
    });
  }

  get filteredAgents(): AgentProfile[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.agents;

    return this.agents.filter((agent) =>
      [
        agent.full_name,
        agent.email,
        agent.phone ?? '',
        agent.office_name ?? '',
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }
}
