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
}
