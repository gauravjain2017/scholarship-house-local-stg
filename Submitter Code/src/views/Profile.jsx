import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatPhoneDisplay, unformatPhone } from '../utils/format';
import { checkEmail, updateProfile, changePassword, getProfile } from '../api/profile';

/* ====================================================================
 * Profile page — two tabs:
 *   1) Profile Information (edit name / email / phone / address)
 *   2) Change Password
 *
 * Email uniqueness is enforced both client-side (debounced check via
 * /profile/check-email) and server-side (the controller returns 409 if
 * the email is taken).
 * ==================================================================== */

const TABS = [
  { id: 'info', label: 'Profile Information' },
  { id: 'password', label: 'Change Password' },
];

const Profile = () => {
  const { user, setUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5FAFF] to-[#EAF4FF] py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#072B53]">My Profile</h1>
          <p className="text-gray-500 mt-1">
            Manage your account information and password
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface/95 backdrop-blur-sm border rounded-2xl shadow-xl overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors relative ${
                    active
                      ? 'text-[#1E7AC0] bg-[#F5FAFF]'
                      : 'text-gray-600 hover:text-[#1E7AC0] hover:bg-gray-50'
                  }`}
                  aria-selected={active}
                  role="tab"
                >
                  {tab.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1E7AC0]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab panels */}
          <div className="p-8">
            {activeTab === 'info' && (
              <ProfileInfoTab user={user} setUser={setUser} logout={logout} />
            )}
            {activeTab === 'password' && (
              <ChangePasswordTab logout={logout} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==================================================================
 * Tab 1 — Profile Information
 * ================================================================== */

const splitName = (name = '') => {
  const parts = String(name).trim().split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
};

const ProfileInfoTab = ({ user, setUser, logout }) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });

  // Keep a ref of the user's "current" server email — used by the
  // email-uniqueness check so typing one's own email reports as available.
  const [currentEmail, setCurrentEmail] = useState(
    (user?.email || '').toLowerCase()
  );

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Email-availability state — async, debounced
  const [emailStatus, setEmailStatus] = useState({
    checking: false,
    available: true,
    message: '',
  });
  const emailCheckTimer = useRef(null);

  /* ---- hydrate from server on mount ---- */
  // We always fetch /profile/me so the form reflects the authoritative DB
  // record (including fields like Address that aren't in the login payload).
  // Falls back to the AuthContext user object if the request fails.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const { data } = await getProfile();
        if (cancelled) return;

        const parts = String(data?.Name || '').trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        const addr = data?.Address || {};

        setFormData({
          firstName,
          lastName,
          email: data?.Email || '',
          phone: data?.Phone || '',
          address: addr.street || '',
          city: addr.city || '',
          state: addr.state || '',
          zip: addr.zip || '',
        });
        setCurrentEmail((data?.Email || '').toLowerCase());
      } catch (e) {
        if (cancelled) return;
        // Network failure / auth issue — fall back to what's in AuthContext
        const parts = String(user?.name || '').trim().split(/\s+/);
        setFormData((prev) => ({
          ...prev,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          email: user?.email || '',
          phone: user?.phone || '',
          address: user?.address?.street || '',
          city: user?.address?.city || '',
          state: user?.address?.state || '',
          zip: user?.address?.zip || '',
        }));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccess('');
  };

  /* ---- debounced email uniqueness check ---- */
  useEffect(() => {
    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // No need to check if email matches the user's current one
    if (!email || email.toLowerCase() === currentEmail) {
      setEmailStatus({ checking: false, available: true, message: '' });
      return;
    }

    if (!emailRegex.test(email)) {
      setEmailStatus({
        checking: false,
        available: false,
        message: 'Invalid email format',
      });
      return;
    }

    setEmailStatus((s) => ({ ...s, checking: true, message: 'Checking…' }));

    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const { data } = await checkEmail(email);
        setEmailStatus({
          checking: false,
          available: !!data.available,
          message: data.available
            ? 'Email is available'
            : 'This email is already in use',
        });
      } catch (e) {
        // Don't block the user on a network blip — server will re-check on save
        setEmailStatus({ checking: false, available: true, message: '' });
      }
    }, 500);

    return () => {
      if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    };
  }, [formData.email, currentEmail]);

  const logoutAndRedirect = async () => {
    try {
      if (typeof logout === 'function') await logout();
    } catch (_) {
      /* ignore */
    }
    localStorage.removeItem('token');
    navigate('/auth/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    /* ---- client-side validation (mirrors Register.jsx rules) ---- */
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    const digitsOnly = formData.phone.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 12) {
      setError('Phone number must be between 8 and 12 digits');
      return;
    }

    if (!emailStatus.available) {
      setError('Please choose a different email — this one is already in use');
      return;
    }

    setLoading(true);
    try {
      const { data } = await updateProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone,
        address: {
          street: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zip: formData.zip.trim(),
        },
      });

      setSuccess(data.message || 'Profile updated successfully');

      // Update local auth state so the nav/profile menu reflects the change
      if (setUser && data.user) {
        setUser((prev) => ({ ...(prev || {}), ...data.user }));
      }

      // Keep the local "current email" tracker in sync for the uniqueness check
      if (data.user?.email) {
        setCurrentEmail(data.user.email.toLowerCase());
      }

      // If the user changed their email, the JWT is now stale → log them out
      if (data.emailChanged) {
        setSuccess(
          'Profile updated. Because your email changed, please sign in again.'
        );
        setTimeout(() => {
          logoutAndRedirect();
        }, 2000);
      }
    } catch (err) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error;

      if (status === 409) {
        setError(apiMsg || 'This email is already in use by another account.');
      } else {
        setError(apiMsg || 'Failed to update profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* Submit disabled if email check is still in flight or failed */
  const submitDisabled =
    loading || emailStatus.checking || !emailStatus.available;

  /* Initial loading state — show a subtle skeleton instead of an empty form */
  if (initialLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-16 bg-gray-100 rounded-lg" />
        <div className="h-16 bg-gray-100 rounded-lg" />
        <div className="h-16 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
            placeholder="John"
            value={formData.firstName}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
            placeholder="Doe"
            value={formData.lastName}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Email — with live availability indicator */}
          <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          disabled
          readOnly
          className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-500 bg-gray-100 cursor-not-allowed focus:outline-none transition"
          placeholder="john@example.com"
          value={formData.email}
        />
        <p className="mt-1 text-xs text-gray-500">
          Email address cannot be changed.
        </p>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          placeholder="555 123 4567"
          className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
          value={formatPhoneDisplay(formData.phone)}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, phone: unformatPhone(e.target.value) }))
          }
        />
      </div>

      {/* Address (optional block) */}
      <div className="pt-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Address (optional)</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Street
            </label>
            <input
              id="address"
              name="address"
              type="text"
              className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
              placeholder="123 Main St"
              value={formData.address}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                id="city"
                name="city"
                type="text"
                className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                value={formData.city}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                State
              </label>
              <input
                id="state"
                name="state"
                type="text"
                className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                value={formData.state}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="zip" className="block text-sm font-medium text-gray-700">
                ZIP
              </label>
              <input
                id="zip"
                name="zip"
                type="text"
                className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                value={formData.zip}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full sm:w-auto sm:min-w-[180px] flex justify-center py-3 px-6 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0AAFE5] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};

/* ==================================================================
 * Tab 2 — Change Password
 * ================================================================== */

const ChangePasswordTab = ({ logout }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.currentPassword) {
      setError('Please enter your current password');
      return;
    }
    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      const { data } = await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      setSuccess(data.message || 'Password changed successfully.');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      // Server returned requireRelogin → log out and redirect after a short pause
      if (data.requireRelogin) {
        setTimeout(async () => {
          try {
            if (typeof logout === 'function') await logout();
          } catch (_) {}
          localStorage.removeItem('token');
          navigate('/auth/login', { replace: true });
        }, 2000);
      }
    } catch (err) {
      const apiMsg = err?.response?.data?.error;
      setError(apiMsg || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
          value={formData.currentPassword}
          onChange={handleChange}
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Minimum 8 characters"
          className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
          value={formData.newPassword}
          onChange={handleChange}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
          value={formData.confirmPassword}
          onChange={handleChange}
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto sm:min-w-[180px] flex justify-center py-3 px-6 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0AAFE5] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
};

export default Profile;
