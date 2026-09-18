import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from './api';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss'],
})
export class AdminLoginComponent {
  email = '';
  password = '';
  error = '';
  api = inject(Api);
  router = inject(Router);

  go() {
    this.api.login({ email: this.email, password: this.password }).subscribe({
      next: () => this.router.navigateByUrl('/admin'),
      error: () => (this.error = 'Email ou senha inválidos.'),
    });
  }
}
