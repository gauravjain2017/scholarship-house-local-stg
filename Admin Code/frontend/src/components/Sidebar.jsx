import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI } from '../api/notifications';
import { formatPhoneDisplay } from '../utils/format';
import { Link } from 'react-router-dom';
import logoTitleBlack from '../assets/icons/logo-scholarship-house/logo-title-black.png';

/* ---------- Role helpers (mirror Home.jsx) ---------- */
const normalizeRole = (user) =>
  String(user?.role || user?.userType || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
    

const canSubmit = (role) =>
  ['submitter', 'realtor', 'wholesaler', 'bird_dogger',
   'real_estate_professional', 'team_member', 'admin'].includes(role);

const canBrowse = (role) => ['client', 'admin', 'team_member'].includes(role);

const canAccessAdmin = (role) => ['admin', 'team_member'].includes(role);

const getInitials = (user) => {
  if (!user) return '?';
  if (user.name) {
    return user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
  if (user.firstName || user.lastName) {
    return [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase();
  }
  return (user.email?.[0] || '?').toUpperCase();
};

const getDisplayName = (user) => {
  if (!user) return '';
  if (user.name) return user.name;
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  return user.email || '';
};

const getRoleLabel = (role) => {
  const map = {
    admin: 'Administrator',
    validator: 'Validator',
    submitter: 'Submitter',
    realtor: 'Realtor',
    wholesaler: 'Wholesaler',
    bird_dogger: 'Bird Dogger',
    client: 'Client',
    team_member: 'Team Member',
    real_estate_professional: 'Real Estate Professional',
  };
  return map[role] || 'User';
};

/* ---------- Icon components (inline SVG, no emoji) ---------- */
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  analytics:  'M18 20V10 M12 20V4 M6 20v-6',
  users:      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  properties: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  submissions:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  approvals:  'M20 6L9 17l-5-5',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  settings:   'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  submit:     'M12 5v14 M5 12l7-7 7 7',
  browse:     'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  heart:      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  logout:     'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  more:       'M12 5v.01 M12 12v.01 M12 19v.01',
  filter:     'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  tax:        'M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  clientHome: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  submitterHome: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v6 M9 14h6',
  chevron:    'M6 9l6 6 6-6',
};

/* ---------- NavItem ---------- */
const NavItem = ({ to, iconKey, label, badge, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      [
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 group relative',
        isActive
          ? 'bg-accent/10 text-accent'
          : 'text-text-secondary hover:bg-surface hover:text-primary',
      ].join(' ')
    }
  >
    <span className="flex-shrink-0">
      <Icon d={icons[iconKey]} size={18} />
    </span>
    <span className="flex-1 truncate">{label}</span>
    {badge != null && badge > 0 && (
      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
        {badge}
      </span>
    )}
  </NavLink>
);

/* ---------- Section label ---------- */
const SectionLabel = ({ children }) => (
  <p className="mt-6 mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-text-secondary/60 children_txt">
      {children}
  </p>
);

/* ---------- Settings submenu ---------- */
const settingsSubmenus = [
  { to: '/settings/filters', iconKey: 'filter', label: 'Manage Filters' },
  { to: '/settings/tax-rates', iconKey: 'tax', label: 'Manage Tax Rates' },
 
  { to: '/settings/client-home', iconKey: 'clientHome', label: 'Manage Client Home' },
 
  { to: '/settings/client-about', iconKey: 'clientHome', label: 'Manage Client About' },
  { to: '/settings/submitter-home', iconKey: 'submitterHome', label: 'Manage Submitter Home' },
  { to: '/settings/submitter-about', iconKey: 'clientHome', label: 'Manage Client About' },
];
 
const SettingsMenu = ({ onClose }) => {
  const { pathname } = useLocation();
  const isSettingsActive = pathname.startsWith('/settings');
  const [open, setOpen] = useState(isSettingsActive);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={[
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 w-full',
          isSettingsActive
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:bg-surface hover:text-primary',
        ].join(' ')}
      >
        <span className="flex-shrink-0">
          <Icon d={icons.settings} size={18} />
        </span>
        <span className="flex-1 truncate text-left">Settings</span>
        <svg
          width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d={icons.chevron} />
        </svg>
      </button>
      {open && (
        <div className="ml-3 mt-0.5 border-l border-border-subtle pl-2 space-y-0.5">
          {settingsSubmenus.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-surface hover:text-primary',
                ].join(' ')
              }
            >
              <span className="flex-shrink-0">
                <Icon d={icons[item.iconKey]} size={15} />
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- Sidebar ---------- */
const Sidebar = ({ pendingUsers = 0, pendingProperties = 0, pendingSubmissions = 0, mobileOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = normalizeRole(user);

  const isAdmin = canAccessAdmin(role);
  const isSubmitter = canSubmit(role);
  const isBrowser = canBrowse(role);

  const [hovered, setHovered] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const ALLOWED_NOTIFICATION_EMAILS = [
    'developertesting@gmail.com',
    'lance@collegefundingsecrets.com',
  ];
  const canViewNotifications = ALLOWED_NOTIFICATION_EMAILS.includes(user?.email?.toLowerCase());

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getAll().then((res) => res.data.notifications),
    enabled: canViewNotifications,
  });
  const unreadCount = notifications?.filter((n) => !n.notify).length || 0;

  const handleLogout = async () => {
    setShowConfirm(false);
    await logout?.();
    navigate('/auth/login');
  };

  return (
    <aside className={`flex h-screen w-62 flex-col border-r border-border-subtle bg-surface flex-shrink-0 transition-transform duration-300 ease-in-out fixed md:static z-50 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border-subtle px-5">
        <Link to="/" className="flex items-center py-2" onClick={onClose}>
          <img
            src={logoTitleBlack}
            alt="Scholarship House"
            className="h-19 w-[13.5rem]"
          />
        </Link>
        {/* Close button — mobile only */}
        <button
          className="p-1.5 rounded-lg hover:bg-gray-100 md:hidden"
          onClick={onClose}
          aria-label="Close menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* Overview */}
        {isAdmin && (
          <>
            <SectionLabel>Overview</SectionLabel>
            <NavItem to="/" iconKey="dashboard" label="Dashboard" onClick={onClose} />
            {/* <NavItem to="/analytics" iconKey="analytics" label="Analytics" /> */}
          </>
        )}

        {/* Management — admin only */}
        {isAdmin && (
          <>
            <SectionLabel>Management</SectionLabel>
            <NavItem to="/admin/users" iconKey="users" label="Users" badge={pendingUsers} onClick={onClose} />
            <NavItem to="/admin/properties" iconKey="properties" label="Properties" badge={pendingProperties} onClick={onClose} />
            {/* <NavItem to="/admin/submissions" iconKey="submissions" label="Submissions" badge={pendingSubmissions} />
            <NavItem to="/admin/approvals" iconKey="approvals" label="Approvals" /> */}
          </>
        )}

        {/* Submitter actions */}
        {isSubmitter && (
          <>
            <SectionLabel>Actions</SectionLabel>
            <NavItem to="/submit" iconKey="submit" label="Submit a Property" onClick={onClose} />
          </>
        )}

        {/* Client browse */}
       {isBrowser && !isAdmin && (
          <>
            <SectionLabel>Browse</SectionLabel>
            <NavItem to="/deals" iconKey="browse" label="Browse Properties" onClick={onClose} />
             <NavItem to="/favorite-properties" iconKey="heart" label="Favorite Properties" onClick={onClose} />
          </>
        )}


        {/* Admin can also browse */}
            {isAdmin && (
          <>
            <NavItem to="/deals" iconKey="browse" label="Browse Properties" onClick={onClose} />
           <NavItem to="/favorite-properties" iconKey="heart" label="Favorite Properties" onClick={onClose} />
          </>
        )}

        {/* Platform */}
        <SectionLabel>Platform</SectionLabel>
        {canViewNotifications && (
          <NavItem to="/notifications" iconKey="notifications" label="Notifications" badge={unreadCount} onClick={onClose} />
        )}
        <SettingsMenu onClose={onClose} />
      </nav>

      {/* User footer */}
      <div
        className="relative border-t border-border-subtle px-3 py-3"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Hover popup */}
        {hovered && (
          <div className="absolute left-2 right-2 bottom-full  bg-surface border border-[#6F91C6] rounded-lg shadow-lg z-50 p-4 text-sm">
            <div className="mb-2">
              <span className="font-semibold text-primary">Email:</span>{' '}
              <span className="text-text-secondary break-all">{user?.email}</span>
            </div>
            <div className="mb-2">
              <span className="font-semibold text-primary">Phone:</span>{' '}
              <span className="text-text-secondary">
                {user?.phone ? formatPhoneDisplay(user.phone) : 'N/A'}
              </span>
            </div>
            <div className="mb-4">
              <span className="font-semibold text-primary">User Type:</span>{' '}
              <span className="text-text-secondary">{getRoleLabel(role)}</span>
            </div>
            <button
              className="w-full py-2 bg-accent hover:bg-accent-light text-white rounded font-semibold transition-colors"
              onClick={() => setShowConfirm(true)}
            >
              Log Out
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-app transition-colors cursor-pointer">
          {/* Avatar */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-semibold">
            {getInitials(user)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-primary leading-tight">
              {getDisplayName(user)}
            </p>
            <p className="truncate text-xs text-text-secondary leading-tight">
              {getRoleLabel(role)}
            </p>
          </div>
        </div>

        {/* Confirm logout modal */}
        {showConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
            <div className="bg-surface rounded-lg shadow-lg p-6 w-80">
              <div className="mb-4 text-lg font-semibold text-primary">
                Are you sure you want to log out?
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-accent hover:bg-accent-light text-white"
                  onClick={handleLogout}
                >
                  Yes, Log Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
