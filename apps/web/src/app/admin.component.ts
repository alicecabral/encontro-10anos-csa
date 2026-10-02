import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Api } from './api';

@Component({
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent {
  api = inject(Api);
  dashboard: any;
  registrations: any[] = [];
  updatingRegistrationIds = new Set<string>();
  reviewError = '';
  reviewConfirmation: { id: string; name: string; status: 'CONFIRMED' | 'REJECTED' } | null = null;

  constructor() {
    this.api.dashboard().subscribe({
      next: (x) => (this.dashboard = x),
      error: () => (location.href = '/admin/login'),
    });
    this.api.registrations().subscribe((x) => (this.registrations = x.items));
  }

  openProof(id: string) {
    this.api.proof(id).subscribe({
      next: (x) =>
        window.open(x.url || `http://localhost:3000/api/admin/registrations/${id}/proof`, '_blank'),
      error: () =>
        window.open(`http://localhost:3000/api/admin/registrations/${id}/proof`, '_blank'),
    });
  }

  reviewRegistration(id: string, status: 'CONFIRMED' | 'REJECTED') {
    this.reviewError = '';
    this.updatingRegistrationIds.add(id);
    this.api.reviewRegistration(id, status).subscribe({
      next: () => window.location.reload(),
      error: () => {
        this.updatingRegistrationIds.delete(id);
        this.reviewError = 'Não foi possível salvar a análise. Tente novamente.';
      },
    });
  }

  requestReviewConfirmation(registration: any, status: 'CONFIRMED' | 'REJECTED') {
    this.reviewConfirmation = { id: registration.id, name: registration.name, status };
  }

  cancelReviewConfirmation() {
    this.reviewConfirmation = null;
  }

  confirmReview() {
    const confirmation = this.reviewConfirmation;
    if (!confirmation) return;

    this.reviewConfirmation = null;
    this.reviewRegistration(confirmation.id, confirmation.status);
  }
}
