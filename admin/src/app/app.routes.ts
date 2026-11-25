import { Routes } from '@angular/router';
import { ownerGuard } from './owner.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/admin-login').then((m) => m.AdminLogin) },
  {
    path: '',
    canActivate: [ownerGuard],
    loadChildren: () => import('./pages/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
