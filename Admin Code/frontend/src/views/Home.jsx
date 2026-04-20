import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import adminPreview from '../assets/home/adminPreview.png';
import submitPreview from '../assets/home/submitPreview.png';
import browsePreview from '../assets/home/browsePreview.png';
import { getAdminUsers } from '../api/admin';
import { authAPI } from '../api/auth';
import { dealsAPI } from '../api/deals';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/* ---------- Helpers ---------- */

const normalizeRole = (user) =>
  String(user?.role || user?.userType || '')
    .toLowerCase()
    .replace(/\s+/g, '_');

const canSubmit = (role) =>
  [
    'submitter',
    'realtor',
    'wholesaler',
    'bird_dogger',
    'real_estate_professional',
    'team_member',
    'admin',
  ].includes(role);

const canBrowse = (role) => ['client', 'admin', 'team_member'].includes(role);

const canAccessAdmin = (role) => ['admin', 'team_member'].includes(role);

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
    team_member: 'Scholarship House Team Member',
    real_estate_professional: 'Real Estate Professional',
  };
  return map[role] || 'User';
};

const roleExplanations = {
  admin: {
    title: 'Manage the platform',
    items: [
      {
        title: 'Review and approve activity',
        description:
          'Oversee property submissions and user registrations to ensure quality and accuracy.',
      },
      {
        title: 'Publish and manage listings',
        description:
          'Approve, reject, or publish properties to control what customers see.',
      },
    ],
  },

  team_member: {
    title: 'Review and support submissions',
    items: [
      {
        title: 'Review submitted properties',
        description:
          'Access and review property submissions to help ensure accuracy, completeness, and quality.',
      },
      {
        title: 'Submit on behalf of others',
        description:
          'Add properties for clients, partners, or team members when additional support is needed.',
      },
    ],
  },

  submitter: {
    title: 'Submit investment opportunities',
    items: [
      {
        title: 'Create new property submissions',
        description:
          'Submit short-term rental opportunities for review and approval.',
      },
      {
        title: 'Track submission status',
        description:
          'Monitor whether your listings are pending, approved, or published.',
      },
    ],
  },

  client: {
    title: 'Explore investment opportunities',
    items: [
      {
        title: 'Browse published deals',
        description:
          'View approved short-term rental listings with detailed metrics.',
      },
      {
        title: 'Save listings for later',
        description:
          "Favorite properties you're interested in and revisit them anytime.",
      },
    ],
  },
};

const withIndefiniteArticle = (phrase) => {
  if (!phrase) return '';
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
};

/* ---------- UI ---------- */

const StatCard = ({ label, value, sub, colorClass, borderClass }) => (
  <div className={`bg-surface border border-border-subtle rounded-2xl shadow-sm overflow-hidden`}>
    <div className={`h-1 w-full ${borderClass}`} />
    <div className="p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">
        {label}
      </p>
      <p className={`text-3xl font-bold ${colorClass} mb-3`}>{value}</p>
      <p className="text-sm text-text-secondary">{sub}</p>
    </div>
  </div>
);

const HomeCard = ({ to, title, description, image }) => (
  <Link
    to={to}
    className="group bg-surface border border-border-subtle rounded-2xl overflow-hidden
               shadow-sm transition hover:shadow-lg hover:-translate-y-1"
  >
    {image && (
      <div className="h-32 bg-app overflow-hidden">
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
    )}
    <div className="p-6">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-text-secondary">{description}</p>
      )}
    </div>
  </Link>
);

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [actionTarget, setActionTarget] = useState(null); // { user, type: 'approve' | 'reject' }
  const [usersLoading, setUsersLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await getAdminUsers();
        setUsers(res.data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const data = await authAPI.getPendingRegistrations();
        setPendingUsers(data);
      } catch (err) {
        console.error('Failed to fetch pending registrations:', err);
      } finally {
        setPendingLoading(false);
      }
    };
    fetchPending();
  }, []);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const data = await dealsAPI.getAllDeals();
        setDeals(data);
      } catch (err) {
        console.error('Failed to fetch deals:', err);
      } finally {
        setDealsLoading(false);
      }
    };
    fetchDeals();
  }, []);

  const totalProperties = deals.length;
  const approvedProperties = deals.filter(d => d.status === 'approved').length;
  const publishedProperties = deals.filter(d => d.status === 'published').length;
  const pendingProperties = deals.filter(d => d.status === 'pending').length;
  const rejectedProperties = deals.filter(d => d.status === 'rejected').length;
  const soldProperties = deals.filter(d => d.status === 'sold').length;

  const PROPERTY_PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const propertyPieData = [
    { name: 'Total Added', value: totalProperties },
    { name: 'Approved', value: approvedProperties },
    { name: 'Published', value: publishedProperties },
    { name: 'Pending', value: pendingProperties },
    { name: 'Rejected', value: rejectedProperties },
    { name: 'Sold', value: soldProperties },
  ].filter(d => d.value > 0);

  const totalUsers = users.length ?? 0;

  const activeUsersCount = users.filter(u => u?.isActive === true).length;
  const inActiveUserCount = users.filter(u => u?.isActive === false).length;
  const pendingCount = pendingUsers.length;

  const handleApprove = async (email) => {
    try {
      await authAPI.approveRegistration(email);
      setPendingUsers(prev => prev.filter(u => u.email !== email));
    } catch (err) {
      console.error('Failed to approve:', err);
      alert('Failed to approve user');
    }
  };

  const handleReject = async (email) => {
    try {
      await authAPI.rejectRegistration(email);
      setPendingUsers(prev => prev.filter(u => u.email !== email));
    } catch (err) {
      console.error('Failed to reject:', err);
      alert('Failed to reject user');
    }
  };




  const PIE_CHART_EMAILS = ['developertesting@gmail.com', 'lance@collegefundingsecrets.com'];

  const role = normalizeRole(user);
  const showBrowse = canBrowse(role);
  const isAdminLike = ['admin', 'team_member'].includes(role);
  const showPieChart = isAdminLike || PIE_CHART_EMAILS.includes(user?.email?.toLowerCase());
  const isSubmitterOnly = canSubmit(role) && !isAdminLike;

  return (
    <div className="bg-app min-h-screen">

      <div className="md:p-10 p-7 max-w-7xl mx-auto">
        <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 p-6 md:mb-10 mb-6 shadow-sm">
          <h1 className="text-2xl md:text-4xl font-semibold text-primary mb-3">
            Welcome{getDisplayName(user) ? `, ${getDisplayName(user)}` : ''}
          </h1>
          <p className="text-base text-text-secondary">
            You are {withIndefiniteArticle(getRoleLabel(role))}.
          </p>
            <div className="md:mt-6 mt-3 h-1 w-32 bg-accent rounded-full" />
        </div>
        {/* ---------- How this platform works ---------- */}
         <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 md:mb-10 shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-primary mb-3">How this platform works</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            This platform showcases short-term rental investment opportunities submitted by vetted partners.
            Each property is reviewed before being published, so you can browse with confidence and focus on
            opportunities that match your goals.
          </p>
        </div>

        {/* ---------- Role explanation ---------- */}
        {roleExplanations[role] && !isAdminLike && (
         <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 md:mb-10 shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-primary mb-6">{roleExplanations[role].title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {roleExplanations[role].items.map((item) => (
                <div key={item.title} className="bg-panel border border-border-subtle rounded-2xl p-6">
                  <h3 className="text-base font-semibold text-primary mb-2">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Quick-access cards ---------- */}
        {!isAdminLike && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:mb-14 mb-6">
            {canSubmit(role) && (
              <HomeCard
                to="/submit"
                title="Submit a Property"
                description="Submit a property on behalf of another user."
                image={submitPreview}
              />
            )}
            {showBrowse && (
              <HomeCard
                to="/deals"
                title="Browse Deals"
                description="View published properties available to customers."
                image={browsePreview}
              />
            )}
          </div>
        )}

        {/* ---------- Stats Grid (admin/team_member only) ---------- */}
        {isAdminLike && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                { label: 'Pending Registrations', value: pendingCount, sub: `${pendingCount} awaiting approval`, colorClass: 'text-blue-500', borderClass: 'bg-blue-500', loading: pendingLoading, path: '/admin/users?type=pending', state: { from: 'dashboard' } },
                { label: 'Active Users', value: activeUsersCount, sub: `${activeUsersCount} users active`, colorClass: 'text-teal-500', borderClass: 'bg-teal-500', loading: usersLoading, path: '/admin/users?type=active' },
                { label: 'Deactive User', value: inActiveUserCount, sub: inActiveUserCount > 0 ? `${inActiveUserCount} users inactive` : 'No inactive users', colorClass: 'text-red-500', borderClass: 'bg-red-500', loading: usersLoading, path: '/admin/deactivated-users' },
                { label: 'Total Users', value: totalUsers, sub: 'Total registered accounts', colorClass: 'text-green-500', borderClass: 'bg-green-500', loading: usersLoading, path: '/admin/users' },
              ].map(({ label, value, sub, colorClass, borderClass, loading, path, state }) => (
                <div key={label} onClick={() => navigate(path, { state })} className="bg-surface border border-border-subtle rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                  <div className={`h-1 w-full ${borderClass}`} />
                  <div className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">{label}</p>
                    {loading ? (
                      <>
                        <div className="h-8 w-16 rounded-lg bg-gray-200 animate-pulse mb-3" />
                        <div className="h-3 w-36 rounded bg-gray-200 animate-pulse" />
                      </>
                    ) : (
                      <>
                        <p className={`text-3xl font-bold ${colorClass} mb-3`}>{value}</p>
                        <p className="text-sm text-text-secondary">{sub}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ---------- Property Status Pie Chart ---------- */}
            {showPieChart && <div className="bg-surface border border-border-subtle rounded-2xl shadow-sm mb-10 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
                <h2 className="text-base font-semibold text-primary">Property Status Overview</h2>
              </div>
              <div className="p-6">
                {dealsLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="h-48 w-48 rounded-full bg-gray-200 animate-pulse" />
                  </div>
                ) : propertyPieData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-sm text-text-secondary">
                    No properties found
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row items-center gap-8">
                    <div className="w-full lg:w-1/2" style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={propertyPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={110}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {propertyPieData.map((entry, index) => (
                              <Cell key={entry.name} fill={PROPERTY_PIE_COLORS[index % PROPERTY_PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            wrapperStyle={{ fontSize: '13px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full lg:w-1/2 grid grid-cols-2 gap-4">
                      {[
                        { label: 'Total Added', value: totalProperties, color: 'text-blue-500', bg: 'bg-blue-50', dot: 'bg-blue-500', status: 'All' },
                        { label: 'Approved', value: approvedProperties, color: 'text-emerald-500', bg: 'bg-emerald-50', dot: 'bg-emerald-500', status: 'approved' },
                        { label: 'Published', value: publishedProperties, color: 'text-emerald-500', bg: 'bg-emerald-50', dot: 'bg-emerald-500', status: 'published' },
                        { label: 'Pending', value: pendingProperties, color: 'text-amber-500', bg: 'bg-amber-50', dot: 'bg-amber-500', status: 'pending' },
                        { label: 'Rejected', value: rejectedProperties, color: 'text-red-500', bg: 'bg-red-50', dot: 'bg-red-500', status: 'rejected' },
                        { label: 'Sold', value: soldProperties, color: 'text-violet-500', bg: 'bg-violet-50', dot: 'bg-violet-500', status: 'sold' },
                      ].map(({ label, value, color, bg, dot, status }) => (
                        <div key={label}
                          onClick={() => navigate(`/admin/properties?status=${status}`)}
                          className={`${bg} rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${dot}`} />
                            <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">{label}</span>
                          </div>
                          <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>}

            {/* ---------- Pending User Registrations Table ---------- */}
            <div className="bg-surface border border-border-subtle rounded-2xl shadow-sm mb-10 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
                <h2 className="text-base font-semibold text-primary">Pending User Registrations</h2>
                <Link to="/admin/users?type=pending" state={{ from: 'dashboard' }} className="text-sm text-blue-500 hover:underline">View all →</Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-6 py-3">Type</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Submitted</th>
                    <th className="text-left px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pendingLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border-subtle">
                        <td className="px-6 py-4">
                          <div className="h-4 w-32 rounded bg-gray-200 animate-pulse mb-2" />
                          <div className="h-3 w-44 rounded bg-gray-200 animate-pulse" />
                        </td>
                        <td className="px-6 py-4"><div className="h-6 w-24 rounded-full bg-gray-200 animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-6 w-20 rounded-full bg-gray-200 animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200 animate-pulse" /></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <div className="h-6 w-16 rounded-lg bg-gray-200 animate-pulse" />
                            <div className="h-6 w-14 rounded-lg bg-gray-200 animate-pulse" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : pendingUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-text-secondary">
                        No pending registrations
                      </td>
                    </tr>
                  ) : (
                    [...pendingUsers]
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .slice(0, 5)
                      .map((u) => {
                        const typeLabel = u?.requestedUserType ?? '';
                        const submitted = u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—';
                        return (
                          <tr key={u.email} className="hover:bg-panel transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-primary">{getDisplayName(u)}</p>
                              <p className="text-xs text-text-secondary">{u.email}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                Pending
                              </span>
                            </td>
                            <td className="px-6 py-4 text-text-secondary">{submitted}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setActionTarget({ user: u, type: 'approve' })}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => setActionTarget({ user: u, type: 'reject' })}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  Reject
                                </button>
                                {/* <Link to="/admin/users" className="text-xs text-text-secondary hover:text-primary transition-colors">
                                  View all
                                </Link> */}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ---------- Approve / Reject Confirmation Modal ---------- */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md mx-4 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-primary">
                {actionTarget.type === 'approve' ? 'Approve Registration' : 'Reject Registration'}
              </h3>
              <button
                onClick={() => setActionTarget(null)}
                className="text-text-secondary hover:text-primary transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-5">
              Are you sure you want to{' '}
              <strong className={actionTarget.type === 'approve' ? 'text-primary' : 'text-red-600'}>
                {actionTarget.type}
              </strong>{' '}
              this registration?
            </p>
            <div className="bg-panel border border-border-subtle rounded-xl p-4 mb-7 space-y-1 text-sm">
              <p><span className="font-semibold text-primary">Name:</span> <span className="text-text-secondary">{getDisplayName(actionTarget.user)}</span></p>
              <p><span className="font-semibold text-primary">Email:</span> <span className="text-text-secondary">{actionTarget.user.email}</span></p>
              <p><span className="font-semibold text-primary">Requested Role:</span> <span className="text-text-secondary">{getRoleLabel(normalizeRole(actionTarget.user))}</span></p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActionTarget(null)}
                className="px-5 py-2 rounded-lg text-sm font-semibold border border-border-subtle text-text-secondary hover:bg-panel transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (actionTarget.type === 'approve') handleApprove(actionTarget.user.email);
                  else handleReject(actionTarget.user.email);
                  setActionTarget(null);
                }}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity ${actionTarget.type === 'approve' ? 'bg-accent' : 'bg-red-600'
                  }`}
              >
                {actionTarget.type === 'approve' ? 'Approve User' : 'Reject User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
