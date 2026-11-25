import { Routes } from '@angular/router';

/** شاشات لوحة التحكم (محمية بـ ownerGuard من app.routes). كل شاشة بتتحمّل لوحدها (lazy). */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { title: 'admin.nav.dashboard' },
    loadComponent: () => import('./admin-dashboard').then((m) => m.AdminDashboard),
  },
  {
    path: 'orders',
    data: { title: 'admin.nav.orders' },
    loadComponent: () => import('./admin-orders').then((m) => m.AdminOrders),
  },
  {
    path: 'orders/:id',
    data: { title: 'admin.nav.orders' },
    loadComponent: () => import('./admin-order-detail').then((m) => m.AdminOrderDetail),
  },
  {
    path: 'products',
    data: { title: 'admin.nav.products' },
    loadComponent: () => import('./admin-products').then((m) => m.AdminProducts),
  },
  {
    path: 'products/new',
    data: { title: 'admin.nav.products' },
    loadComponent: () => import('./admin-product-form').then((m) => m.AdminProductForm),
  },
  {
    path: 'products/:id',
    data: { title: 'admin.nav.products' },
    loadComponent: () => import('./admin-product-form').then((m) => m.AdminProductForm),
  },
  {
    path: 'categories',
    data: { title: 'admin.nav.categories' },
    loadComponent: () => import('./admin-categories').then((m) => m.AdminCategories),
  },
  {
    path: 'messages',
    data: { title: 'admin.nav.messages' },
    loadComponent: () => import('./admin-messages').then((m) => m.AdminMessages),
  },
  {
    path: 'team',
    data: { title: 'admin.nav.team' },
    loadComponent: () => import('./admin-team').then((m) => m.AdminTeam),
  },
];
