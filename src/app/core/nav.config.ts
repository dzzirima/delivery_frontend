export interface NavChild {
  id: string;
  label: string;
  route: string;
  queryParams?: Record<string, string>;
  /** Key in ApplicationStats for the badge count — only used by the applications group */
  statsKey?: string;
}

export interface NavItem {
  id: string;
  type: 'link' | 'group';
  label: string;
  /** Only used when type === 'link' */
  route?: string;
  /** SVG <path d="..."> strings. Two entries = two paths in the same icon. */
  iconPaths: string[];
  /**
   * Roles that can see this item.
   * Empty array means every authenticated user can see it.
   */
  roles: string[];
  /** Only used when type === 'group' */
  children?: NavChild[];
  /** When true, an "Admin" section divider is rendered before this item. */
  adminSection?: boolean;
}

// ─── Role groups (must match backend UserRole enum exactly) ──────────────────
// AGENT | HR | IT | OPERATIONS | MANAGER | CALL_CENTER_AGENT | STAFF | SYSTEM_ADMIN | ORG_ADMIN
const ALL: string[] = [];
const ADMIN_ROLES     = ['ORG_ADMIN', 'SYSTEM_ADMIN'];
const MANAGE_ROLES    = ['ORG_ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'HR'];
const PAYROLL_ROLES   = ['ORG_ADMIN', 'SYSTEM_ADMIN', 'HR', 'MANAGER'];
const ANALYTICS_ROLES = ['ORG_ADMIN', 'SYSTEM_ADMIN', 'MANAGER'];

export const NAV_ITEMS: NavItem[] = [
  // ── Main ────────────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    type: 'link',
    label: 'Dashboard',
    route: '/app/dashboard',
    roles: ALL,
    iconPaths: [
      'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    ],
  },
  {
    id: 'applications',
    type: 'group',
    label: 'Applications',
    roles: ALL,
    iconPaths: [
      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    ],
    children: [
      { id: 'app-applied',    label: 'Applied',    route: '/app/applications', queryParams: { status: 'APPLIED' },    statsKey: 'applied' },
      { id: 'app-pending',    label: 'Pending',    route: '/app/applications', queryParams: { status: 'PENDING' },    statsKey: 'pending' },
      { id: 'app-interview',  label: 'Interview',  route: '/app/applications', queryParams: { status: 'INTERVIEW' },  statsKey: 'interview' },
      { id: 'app-assessment', label: 'Assessment', route: '/app/applications', queryParams: { status: 'ASSESSMENT' }, statsKey: 'assessment' },
      { id: 'app-rejected',   label: 'Rejected',   route: '/app/applications', queryParams: { status: 'REJECTED' },   statsKey: 'rejected' },
      { id: 'app-offer',      label: 'Offer',      route: '/app/applications', queryParams: { status: 'OFFER' },      statsKey: 'offer' },
      { id: 'app-on-hold',    label: 'On Hold',    route: '/app/applications', queryParams: { status: 'ON_HOLD' },    statsKey: 'onHold' },
    ],
  },
  {
    id: 'calendar',
    type: 'link',
    label: 'Interview Calendar',
    route: '/app/calendar',
    roles: ALL,
    iconPaths: [
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    ],
  },
  {
    id: 'portfolio',
    type: 'link',
    label: 'Profiles',
    route: '/app/portfolio',
    roles: ALL,
    iconPaths: [
      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    ],
  },
  {
    id: 'gigs',
    type: 'link',
    label: 'Gigs',
    route: '/app/gigs',
    roles: ALL,
    iconPaths: [
      'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    ],
  },
  {
    id: 'payroll',
    type: 'group',
    label: 'Payroll Bill',
    roles: PAYROLL_ROLES,
    iconPaths: [
      'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    ],
    children: [
      { id: 'payroll-bills', label: 'Bills',   route: '/app/payroll-bills' },
      { id: 'payslips',      label: 'Payslip', route: '/app/payslips' },
    ],
  },

  // ── Admin section ────────────────────────────────────────────────────────────
  {
    id: 'analytics',
    type: 'link',
    label: 'Analytics',
    route: '/app/analytics',
    roles: ANALYTICS_ROLES,
    adminSection: true,
    iconPaths: [
      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    ],
  },
  {
    id: 'users',
    type: 'link',
    label: 'Users',
    route: '/app/users',
    roles: MANAGE_ROLES,
    iconPaths: [
      'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    ],
  },
  {
    id: 'organizations',
    type: 'link',
    label: 'Organisations',
    route: '/app/organizations',
    roles: ADMIN_ROLES,
    iconPaths: [
      'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    ],
  },
  {
    id: 'settings',
    type: 'link',
    label: 'Settings',
    route: '/app/settings',
    roles: ADMIN_ROLES,
    iconPaths: [
      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    ],
  },
];
