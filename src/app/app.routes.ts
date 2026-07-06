import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { profileResolver } from './core/resolvers/profile.resolver';

export const routes: Routes = [
  // ── Public ──────────────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./features/auth/landing/landing').then(m => m.Landing),
  },
  {
    path: 'signin',
    loadComponent: () => import('./features/auth/signin/signin').then(m => m.Signin),
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup/signup').then(m => m.Signup),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword),
  },
  {
    path: 'access-denied',
    loadComponent: () => import('./features/access-denied/access-denied').then(m => m.AccessDenied),
  },

  // ── System admin (TIH team only) ────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['SYSTEM_ADMIN'])],
    resolve: { profile: profileResolver },
    loadComponent: () => import('./features/system-admin/system-admin').then(m => m.SystemAdmin),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () => import('./features/system-admin/overview/overview').then(m => m.SystemOverview),
      },
      {
        path: 'kyc',
        loadComponent: () => import('./features/system-admin/kyc/kyc').then(m => m.AdminKyc),
      },
      {
        path: 'riders',
        loadComponent: () => import('./features/system-admin/riders/riders').then(m => m.AdminRiders),
      },
      {
        path: 'organisations',
        loadComponent: () => import('./features/system-admin/organisations/organisations').then(m => m.AdminOrganisations),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/system-admin/users/users').then(m => m.AdminUsers),
      },
    ],
  },

  // ── Org operator (ORG_ADMIN + DISPATCHER) ───────────────────────────────────
  {
    path: 'org',
    canActivate: [authGuard, roleGuard(['ORG_ADMIN', 'DISPATCHER'])],
    resolve: { profile: profileResolver },
    loadComponent: () => import('./features/org-dashboard/org-dashboard').then(m => m.OrgDashboard),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () => import('./features/org-dashboard/overview/overview').then(m => m.Overview),
      },
      {
        path: 'deliveries',
        loadComponent: () => import('./features/org-dashboard/deliveries/deliveries').then(m => m.Deliveries),
      },
      {
        path: 'deliveries/:id',
        loadComponent: () => import('./features/org-dashboard/deliveries/delivery-detail/delivery-detail').then(m => m.DeliveryDetail),
      },
      {
        path: 'fleet',
        loadComponent: () => import('./features/org-dashboard/fleet/fleet').then(m => m.Fleet),
      },
      {
        path: 'shops',
        loadComponent: () => import('./features/org-dashboard/shops/shops').then(m => m.Shops),
      },
      {
        path: 'shops/:shopId',
        loadComponent: () => import('./features/org-dashboard/shops/shop-detail/shop-detail').then(m => m.ShopDetail),
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/org-dashboard/clients/clients').then(m => m.Clients),
      },
      {
        path: 'members',
        loadComponent: () => import('./features/org-dashboard/members/members').then(m => m.Members),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/org-dashboard/settings/settings').then(m => m.Settings),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/org-dashboard/profile/profile').then(m => m.Profile),
      },
    ],
  },

  // ── Catch-all ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
