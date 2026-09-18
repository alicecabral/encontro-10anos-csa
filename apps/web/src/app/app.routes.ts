import { Routes } from '@angular/router';
import { LandingComponent } from './landing.component';
import { RegistrationComponent } from './registration.component';
import { AdminComponent } from './admin.component';
import { AdminLoginComponent } from './admin-login.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'confirmar-presenca', component: RegistrationComponent },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: '' },
];
