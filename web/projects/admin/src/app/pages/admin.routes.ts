import { Routes } from '@angular/router';

/** شاشات لوحة التحكم (محمية بـ ownerGuard من app.routes). كل شاشة بتتحمّل لوحدها (lazy). */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'orders',
        loadComponent: () => import('./admin-orders').then((m) => m.AdminOrders),
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./admin-order-detail').then((m) => m.AdminOrderDetail),
      },
      {
        path: 'products',
        loadComponent: () => import('./admin-products').then((m) => m.AdminProducts),
      },
      {
        path: 'products/new',
        loadComponent: () => import('./admin-product-form').then((m) => m.AdminProductForm),
      },
      {
        path: 'products/:id',
        loadComponent: () => import('./admin-product-form').then((m) => m.AdminProductForm),
      },
      {
        path: 'messages',
        loadComponent: () => import('./admin-messages').then((m) => m.AdminMessages),
      },
    ],
  },
];
