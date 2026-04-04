import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { applicationDetailResolver } from './features/applications/application-detail/application-detail.resolver';
import { gigDashboardResolver } from './features/gigs/gig-dashboard/gig-dashboard.resolver';

export const routes: Routes = [
  // Landing
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then(m => m.Landing),
  },

  // Auth layout — wraps all public auth pages
  {
    path: '',
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then(m => m.AuthLayout),
    children: [
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
    ],
  },

  // Protected app — main layout with sidebar
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/main-layout/main-layout').then(m => m.MainLayout),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardPage),
      },
      {
        path: 'applications',
        loadComponent: () => import('./features/applications/applications').then(m => m.Applications),
      },
      {
        path: 'applications/:id',
        resolve: { application: applicationDetailResolver },
        loadComponent: () => import('./features/applications/application-detail/application-detail').then(m => m.ApplicationDetailPage),
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/calendar/calendar').then(m => m.Calendar),
      },
      {
        path: 'portfolio',
        loadComponent: () => import('./features/portfolio/portfolio').then(m => m.PortfolioPage),
      },
      {
        path: 'portfolio/:id',
        loadComponent: () => import('./features/portfolio/portfolio-detail/portfolio-detail').then(m => m.PortfolioDetail),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/users').then(m => m.UsersPage),
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./features/users/user-detail/user-detail').then(m => m.UserDetail),
      },
      {
        path: 'organizations',
        loadComponent: () => import('./features/organizations/organizations').then(m => m.OrganizationsPage),
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics').then(m => m.AnalyticsPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.Settings),
      },
      {
        path: 'gigs',
        loadComponent: () => import('./features/gigs/gigs-list/gigs-list').then(m => m.GigsList),
      },
      {
        path: 'payroll',
        loadComponent: () => import('./features/payslips/payroll/payroll').then(m => m.Payroll),
      },
      {
        path: 'gigs/create',
        loadComponent: () => import('./features/gigs/gig-create/gig-create').then(m => m.GigCreate),
      },
      {
        path: 'gigs/:id',
        resolve: { gig: gigDashboardResolver },
        loadComponent: () => import('./features/gigs/gig-dashboard/gig-dashboard').then(m => m.GigDashboard),
      },
    ],
  },

  // Legacy redirect
  {
    path: 'dashboard',
    redirectTo: '/app/applications',
    pathMatch: 'full',
  },

  { path: '**', redirectTo: '/signin' },
];
