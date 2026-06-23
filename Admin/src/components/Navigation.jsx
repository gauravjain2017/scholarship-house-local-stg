import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import ProfileMenu from './ProfileMenu';
import { getCanonicalRole } from '../utils/roles';
import logoTitleBlack from '../assets/icons/logo-scholarship-house/logo-title-black.png';
import { notificationsAPI } from '../api/notifications';

const BellIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const Navigation = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Hide navigation on auth pages
  if (location.pathname.startsWith('/auth')) return null;

  const role = user ? getCanonicalRole(user.userType) : null;
  const tabs = [];

  // --- Submit Property ---
  if (
    ['submitter', 'team_member', 'admin'].includes(
      getCanonicalRole(user?.userType)
    )
  ) {
    tabs.push({ path: '/submit', label: 'Submit Property' });
  }

  // --- My Properties (submitter only) ---
  if (['submitter'].includes(getCanonicalRole(user?.userType))) {
    tabs.push({ path: '/my-properties', label: 'My Properties' });
  }

  // --- Admin ---
  if (['admin', 'team_member'].includes(getCanonicalRole(user?.userType))) {
    tabs.push({ path: '/admin', label: 'Admin Dashboard' });
  }

  // --- Browse Properties ---
  if (
    ['client', 'team_member', 'admin'].includes(
      getCanonicalRole(user?.userType)
    )
  ) {
    tabs.push({ path: '/deals', label: 'Browse Properties' });
    tabs.push({ path: '/favorite-properties', label: 'Favorite Properties' });
  }

  // --- Home (everyone) ---
  tabs.push({ path: '/', label: 'Home' });

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/deals') return location.pathname.startsWith('/deals');
    return location.pathname === path;
  };

  const isNotifActive = location.pathname.startsWith('/property-notifications');

  // Fetch real unread count from /api/notifications/my
  const { data: notifications } = useQuery({
    queryKey: ['property-notifications', user?.email],
    queryFn: () =>
      notificationsAPI.getMyNotifications().then((res) => res.data.notifications),
    enabled: !!user?.email,
    refetchInterval: 60000, // refresh every 60 seconds
  });

  const unreadCount = (notifications || []).filter((n) => !n.notify).length;

  return (
    <nav className="bg-surface shadow-md border-b-2 border-accent relative">
      <div className="w-full px-[10px] md:px-6">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center py-2 logo_img">
            <img
              src={logoTitleBlack}
              alt="Scholarship House"
              className="h-20 w-auto"
            />
          </Link>

          {isAuthenticated && (
            <>
              {/* Desktop nav */}
              <div className="hidden md:flex items-center">
                {tabs.map((item, idx) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-4 rounded-lg font-medium transition-colors ${isActive(item.path)
                      ? 'bg-surface-muted text-primary'
                      : 'text-gray-700 hover:bg-surface-alt'
                      } ${idx === tabs.length - 1 ? 'mr-2' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}

                {/* Notification Bell — shows real unread count */}
                {role !== 'submitter' && (
                  <Link
                    to="/property-notifications"
                    className={`relative flex items-center justify-center w-10 h-10 rounded-lg mr-2 transition-colors ${isNotifActive
                      ? 'bg-surface-muted text-primary'
                      : 'text-gray-700 hover:bg-surface-alt'
                      }`}
                    aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                  >
                    <BellIcon />
                    {unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold leading-none"
                        aria-hidden="true"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}

                <ProfileMenu />
              </div>

              {/* Mobile: bell + hamburger */}
           
			    <div className="flex items-center md:hidden profile_menu_mob">
               {role !== 'submitter' && (
                 <Link
                    to="/property-notifications"
                    className={`relative flex items-center md:justify-center justify-end w-10 h-10 rounded-lg md:mr-1 mr-0 transition-colors ${isNotifActive
                      ? 'text-primary'
                      : 'text-gray-700'
                      }`}
                    aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                  >
                    <BellIcon />
                    {unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold leading-none"
                        aria-hidden="true"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}
                <ProfileMenu />
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="ml-1 p-2 rounded-lg text-gray-700 focus:outline-none"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="md:hidden bg-surface border-t border-gray-200 shadow-lg">
          <div className="flex flex-col py-2">
            {tabs.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-6 py-3 font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-accent/10 text-primary border-l-4 border-accent'
                    : 'text-gray-700 hover:bg-surface-alt border-l-4 border-transparent'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
