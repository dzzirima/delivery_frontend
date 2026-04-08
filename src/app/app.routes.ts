import { Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';
import { applicationDetailResolver } from './features/applications/application-detail/application-detail.resolver';
import { gigDashboardResolver } from './features/gigs/gig-dashboard/gig-dashboard.resolver';

// ── Role groups (backend UserRole enum) ──────────────────────────────────────
// AGENT | HR | IT | OPERATIONS | MANAGER | CALL_CENTER_AGENT | STAFF | SYSTEM_ADMIN | ORG_ADMIN
const ADMIN_ROLES   = ['ORG_ADMIN', 'SYSTEM_ADMIN'];
const MANAGE_ROLES  = ['ORG_ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'HR'];
const PAYROLL_ROLES = ['ORG_ADMIN', 'SYSTEM_ADMIN', 'HR', 'MANAGER'];
const ANALYTICS_ROLES = ['ORG_ADMIN', 'SYSTEM_ADMIN', 'MANAGER'];

export const routes: Routes = [

  // ── Public ──────────────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then(m => m.Landing),
  },
  {
    path: '',
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then(m => m.AuthLayout),
    children: [
      { path: 'signin',          loadComponent: () => import('./pages/signin/signin').then(m => m.Signin) },
      { path: 'signup',          loadComponent: () => import('./pages/signup/signup').then(m => m.Signup) },
      { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password').then(m => m.ForgotPassword) },
      { path: 'reset-password',  loadComponent: () => import('./pages/reset-password/reset-password').then(m => m.ResetPassword) },
    ],
  },

  // ── Protected app ─────────────────────────────────────────────────────────
  {
    path: 'app',
    canActivate: [roleGuard],   // roles[] empty → any authenticated user
    data: { roles: [] },
    loadComponent: () => import('./layouts/main-layout/main-layout').then(m => m.MainLayout),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // All authenticated users
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardPage),
      },
      {
        path: 'applications',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/applications/applications').then(m => m.Applications),
      },
      {
        path: 'applications/:id',
        canActivate: [roleGuard],
        data: { roles: [] },
        resolve: { application: applicationDetailResolver },
        loadComponent: () => import('./features/applications/application-detail/application-detail').then(m => m.ApplicationDetailPage),
      },
      {
        path: 'calendar',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/calendar/calendar').then(m => m.Calendar),
      },
      {
        path: 'portfolio',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/portfolio/portfolio').then(m => m.PortfolioPage),
      },
      {
        path: 'portfolio/:id',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/portfolio/portfolio-detail/portfolio-detail').then(m => m.PortfolioDetail),
      },
      {
        path: 'gigs',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/gigs/gigs-list/gigs-list').then(m => m.GigsList),
      },
      {
        path: 'gigs/create',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/gigs/gig-create/gig-create').then(m => m.GigCreate),
      },
      {
        path: 'gigs/:id',
        canActivate: [roleGuard],
        data: { roles: [] },
        resolve: { gig: gigDashboardResolver },
        loadComponent: () => import('./features/gigs/gig-dashboard/gig-dashboard').then(m => m.GigDashboard),
      },
      {
        path: 'payslips',
        canActivate: [roleGuard],
        data: { roles: [] },
        loadComponent: () => import('./features/payslips/my-payslips/my-payslips').then(m => m.MyPayslips),
      },

      // Payroll — HR, Managers, Admins
      {
        path: 'payroll-bills',
        canActivate: [roleGuard],
        data: { roles: PAYROLL_ROLES },
        loadComponent: () => import('./features/payroll-bills/payroll-bill-list/payroll-bill-list').then(m => m.PayrollBillList),
      },
      {
        path: 'payroll-bills/:id',
        canActivate: [roleGuard],
        data: { roles: PAYROLL_ROLES },
        loadComponent: () => import('./features/payroll-bills/payroll-bill-detail/payroll-bill-detail').then(m => m.PayrollBillDetailPage),
      },
      {
        path: 'payroll',
        canActivate: [roleGuard],
        data: { roles: ['ORG_ADMIN', 'SYSTEM_ADMIN', 'HR'] },
        loadComponent: () => import('./features/payslips/payroll/payroll').then(m => m.Payroll),
      },

      // Analytics — Managers and Admins
      {
        path: 'analytics',
        canActivate: [roleGuard],
        data: { roles: ANALYTICS_ROLES },
        loadComponent: () => import('./features/analytics/analytics').then(m => m.AnalyticsPage),
      },

      // User management — HR, Managers, Admins
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: MANAGE_ROLES },
        loadComponent: () => import('./features/users/users').then(m => m.UsersPage),
      },
      {
        path: 'users/:id',
        canActivate: [roleGuard],
        data: { roles: MANAGE_ROLES },
        loadComponent: () => import('./features/users/user-detail/user-detail').then(m => m.UserDetail),
      },

      // Org & Settings — Admins only
      {
        path: 'organizations',
        canActivate: [roleGuard],
        data: { roles: ADMIN_ROLES },
        loadComponent: () => import('./features/organizations/organizations').then(m => m.OrganizationsPage),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ADMIN_ROLES },
        loadComponent: () => import('./features/settings/settings').then(m => m.Settings),
      },
    ],
  },

  // ── Post-login setup flow (no sidebar) ───────────────────────────────────
  {
    path: 'setup-organization',
    canActivate: [roleGuard],
    data: { roles: [] },
    loadComponent: () => import('./pages/setup-organization/setup-organization').then(m => m.SetupOrganization),
  },
  {
    path: 'org-inactive',
    canActivate: [roleGuard],
    data: { roles: [] },
    loadComponent: () => import('./pages/org-inactive/org-inactive').then(m => m.OrgInactive),
  },

  // ── Fallbacks ──────────────────────────────────────────────────────────────
  { path: 'dashboard', redirectTo: '/app/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/signin' },
];
