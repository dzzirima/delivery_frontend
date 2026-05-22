import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // ── Public ──────────────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then(m => m.Landing),
  },
  {
    path: 'signin',
    loadComponent: () => import('./pages/signin/signin').then(m => m.Signin),
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup').then(m => m.Signup),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then(m => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password').then(m => m.ResetPassword),
  },
  {
    path: 'access-denied',
    loadComponent: () => import('./pages/access-denied/access-denied').then(m => m.AccessDenied),
  },

  // ── System admin (TIH team only) ────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
  },

  // ── Org operator (ORG_ADMIN + DISPATCHER) ───────────────────────────────────
  {
    path: 'org',
    canActivate: [authGuard, roleGuard(['ORG_ADMIN', 'DISPATCHER'])],
    loadComponent: () => import('./pages/org-dashboard/org-dashboard').then(m => m.OrgDashboard),
  },

  // ── Legacy redirect ─────────────────────────────────────────────────────────
  // Keep old /dashboard URL alive — guards will sort the role
  {
    path: 'dashboard',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
  },

  // ── Catch-all ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
