import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import '../styles/main.css';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/admin/users': 'User Management',
  '/admin/properties': 'Property Management',
  '/admin/submissions': 'Submissions',
  '/settings/filters': 'Manage Filters',
  '/settings/tax-rates': 'Manage Tax Rates',
  '/settings/client-home': 'Manage Client Home Page',
  '/settings/submitter-home': 'Manage House Submitter Home Page',
  '/submit': 'Submit Property',
  '/deals': 'Browse Properties',
  '/notifications': 'Notifications',
  '/favorite-properties': 'Favorite Properties'
};


const AppLayout = ({
  pendingUsers = 0,
  pendingProperties = 0,
  pendingSubmissions = 0,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search } = location;
  const searchParams = new URLSearchParams(search);
  // Build breadcrumb segments: either a single title or an array for nested pages
  const getBreadcrumbs = () => {
    if (pathname.startsWith('/settings/') && PAGE_TITLES[pathname]) {
      return [{ label: 'Settings', path: '/settings/filters' }, PAGE_TITLES[pathname]];
    }
    if (pathname === '/admin/users' && searchParams.get('type') === 'pending') {
      if (location.state?.from === 'dashboard') {
        return [{ label: 'Dashboard', path: '/' }, 'Pending Registrations'];
      }
      return [{ label: 'User Management', path: '/admin/users' }, 'Pending Registrations'];
    }
    if (PAGE_TITLES[pathname]) return [PAGE_TITLES[pathname]];
    if (/^\/admin\/user\/[^/]+$/.test(pathname)) return [{ label: 'User Management', path: '/admin/users' }, 'User Details'];
    if (/^\/deals\/[^/]+$/.test(pathname)) {
      if (location.state?.from === 'admin-properties') {
        return [{ label: 'Property Management', path: '/admin/properties' }, 'Property Details'];
      }
      return [{ label: 'Browse Properties', path: '/deals' }, 'Property Details'];
    }
    if (/^\/favorite-properties\/[^/]+$/.test(pathname)) return [{ label: 'Favorite Properties', path: '/favorite-properties' }, 'Property Details'];
    if (/^\/notifications\/[^/]+$/.test(pathname)) return [{ label: 'Notifications', path: '/notifications' }, 'Notification Deatils'];
    return [];
  };
  const breadcrumbs = getBreadcrumbs();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-app">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <Sidebar
        pendingUsers={pendingUsers}
        pendingProperties={pendingProperties}
        pendingSubmissions={pendingSubmissions}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Right column: header + page content ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* ── Admin Top Header (indented, right of sidebar) ── */}
        <header className="flex items-center justify-between px-4 md:px-6 h-14 bg-white border-b border-gray-200 shrink-0">
          {/* Hamburger + Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <button
              className="mr-2 p-1.5 rounded-lg hover:bg-gray-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span>Admin</span>
            {/* <span className="mx-1">›</span>
            <span className="text-gray-800 font-medium">Dashboard</span> */}
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="mx-1">›</span>
                {typeof crumb === 'object' ? (
                  <span
                    className="text-gray-500 cursor-pointer hover:text-gray-700"
                    onClick={() => navigate(crumb.path)}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? 'text-gray-800 font-medium text-xs md:text-base' : 'text-gray-500'}>
                    {crumb}
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* <button className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-base leading-none">↑</span>
              Export Report
            </button> */}
            <button onClick={() => navigate('/submit')} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors submit_btn">
              + Submit Property
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default AppLayout;
