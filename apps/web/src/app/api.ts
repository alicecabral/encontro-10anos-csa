import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from './environment';

interface AdminDashboard {
  confirmed: number;
  pending: number;
  revenue: number;
  currentLot: { name: string; price: number } | null;
  spotsUntilNextLot: number;
}

interface AdminRegistrationsResponse {
  items: any[];
  total: number;
  page: number;
  limit: number;
}

interface ProofResponse {
  url?: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  event() {
    return this.http.get<any>(`${environment.api}/event`);
  }
  lots() {
    return this.http.get<any[]>(`${environment.api}/lots`);
  }
  register(data: FormData, key: string) {
    return this.http.post<any>(`${environment.api}/registrations`, data, {
      headers: { 'Idempotency-Key': key },
    });
  }
  private getAuthHeaders(): Record<string, string> {
    const token = sessionStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : { Authorization: '' };
  }

  login(body: any) {
    return this.http.post<{ email: string; token: string }>(`${environment.api}/admin/login`, body);
  }
  logout() {
    sessionStorage.removeItem('admin_token');
    return this.http.post(`${environment.api}/admin/logout`, {});
  }
  dashboard() {
    return this.http.get<AdminDashboard>(`${environment.api}/admin/dashboard`, {
      headers: this.getAuthHeaders(),
    });
  }
  registrations() {
    return this.http.get<AdminRegistrationsResponse>(`${environment.api}/admin/registrations`, {
      headers: this.getAuthHeaders(),
    });
  }
  exportRegistrations() {
    return this.http.get(`${environment.api}/admin/registrations/export`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob',
    });
  }
  reviewRegistration(id: string, status: 'CONFIRMED' | 'REJECTED') {
    return this.http.patch<any>(
      `${environment.api}/admin/registrations/${id}/review`,
      { status },
      { headers: this.getAuthHeaders() },
    );
  }
  proof(id: string) {
    return this.http.get<ProofResponse>(`${environment.api}/admin/registrations/${id}/proof`, {
      headers: this.getAuthHeaders(),
    });
  }
}
