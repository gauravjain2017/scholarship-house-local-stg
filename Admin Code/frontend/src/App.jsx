import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navigation from './components/Navigation';
import AppLayout from './components/AppLayout';
import Home from './views/Home';
import SubmitterView from './views/SubmitterView';
import MyProperties from './components/submitter/MyProperties';
import AdminDashboard from './views/AdminDashboard';
import UserManagement from './views/UserManagement';
import UserDetail from './views/UserDetail';
import PropertyManagement from './views/PropertyManagement';
import Notification from './views/Notification';
import NotificationDetail from './views/NotificationDetail';
import PropertyNotification from './views/PropertyNotification';
import PropertyNotificationDetail from './views/PropertyNotificationDetail';
import ClientAboutPage from './views/ClientAboutPage';
import ManageClientAbout from './views/settings/ManageClientAbout';

 


import CustomerView from './views/CustomerView';
import DealDetailPage from './views/DealDetailView';
import FavoriteProperty from './views/FavoriteProperty';
import Login from './views/Login';
import Register from './views/Register';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import DeactivatedUsers from './views/DeactivatedUsers';
import ManageFilters from './views/settings/ManageFilters';
import ManageTaxRates from './views/settings/ManageTaxRates';
import ManageClientHome from './views/settings/ManageClientHome';
import ManageSubmitterHome from './views/settings/ManageSubmitterHome';
import MyDisputes from './views/MyDisputes';
import PublicPropertyView from './views/PublicPropertyView';
import ClientHomePage from './views/ClientHomePage';
import SubmitterHomePage from './views/SubmitterHomePage';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


/* Redirects already-logged-in users away from auth pages to /dashboard */
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
 if (user) return <Navigate to="/" replace />;
  return children;
};


/* Shows sidebar layout for admins (with header), header-only nav for all other roles */
const RoleLayout = () => {
  const { hasRole } = useAuth();
  // console.log('hasRole : ',hasRole('team_member'))
  if (hasRole('admin') || hasRole('team_member')) {
    return <AppLayout />;   // sidebar + header layout for admins
  }

  // All non-admin roles also get the header navigation
  return (
    <div className="min-h-screen bg-app">
      <Navigation />
      <Outlet />
    </div>
  );
};

function App() {
  return (
    <>
      <Router>
        <Routes>

          {/* ── Auth routes (no nav) ── */}
  {/* ── Auth routes (no nav) ── */}
<Route path="/auth/login" element={<PublicRoute><Login /></PublicRoute>} />
<Route path="/auth/register" element={<PublicRoute><Register /></PublicRoute>} />
<Route path="/auth/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
<Route path="/auth/reset-password/:token" element={<ResetPassword />} />


     <Route path="/client-about" element={<ClientAboutPage />} />
<Route path="/settings/client-about" element={<ProtectedRoute><ManageClientAbout /></ProtectedRoute>} />



          {/* ── Public property view (no auth, no sidebar/header) ── */}
          <Route path="/property/:dealId" element={<PublicPropertyView />} />

          {/* ── Client Home Page (renders saved layout from localStorage) ── */}
          <Route path="/client-home" element={<ClientHomePage />} />
          {/* ── Submitter Home Page (renders saved layout for submitters) ── */}
          <Route path="/submitter-home" element={<SubmitterHomePage />} />

          {/* ── Full-page routes (no sidebar) ── */}
          <Route path="/settings/client-home" element={<ProtectedRoute><ManageClientHome /></ProtectedRoute>} />
          <Route path="/settings/submitter-home" element={<ProtectedRoute><ManageSubmitterHome /></ProtectedRoute>} />

          {/* ── Protected routes — layout decided by RoleLayout ── */}
          <Route element={<ProtectedRoute><RoleLayout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/submit" element={<ProtectedRoute requirePermission="CAN_SUBMIT"><SubmitterView /></ProtectedRoute>} />
            <Route path="/my-properties" element={<ProtectedRoute requirePermission="CAN_SUBMIT"><MyProperties /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><UserManagement defaultTab="users" /></ProtectedRoute>} />

            <Route path="/admin/user/:token" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><UserDetail /></ProtectedRoute>} />
            <Route path="/admin/properties" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><PropertyManagement defaultTab="properties" /></ProtectedRoute>} />
            <Route path="/admin/deactivated-users" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><DeactivatedUsers /></ProtectedRoute>} />
            {/* <Route path="/admin/submissions" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard defaultTab="submissions" /></ProtectedRoute>} />
          <Route path="/admin/approvals"   element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard defaultTab="approvals" /></ProtectedRoute>} /> */}
            <Route path="/admin/notifications" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/notifications" element={<Notification />} />
            <Route path="/notifications/:id" element={<NotificationDetail />} />
            <Route path="/deals" element={<ProtectedRoute blockRole="submitter"><CustomerView /></ProtectedRoute>} />
            <Route path="/deal-details/:dealId" element={<ProtectedRoute><DealDetailPage /></ProtectedRoute>} />

            <Route path="/settings/filters" element={<ManageFilters />} />
            <Route path="/settings/tax-rates" element={<ManageTaxRates />} />
            {/* ManageClientHome & ManageSubmitterHome moved outside RoleLayout for full-page view */}
            <Route path="/settings" element={<Navigate to="/settings/filters" replace />} />
            <Route path="/favorite-properties" element={<ProtectedRoute blockRole="submitter"><FavoriteProperty /></ProtectedRoute>} />
            <Route path="/favorite-properties/:dealId" element={<ProtectedRoute blockRole="submitter"><FavoriteProperty /></ProtectedRoute>} />

			<Route path="/property-notifications"         element={<ProtectedRoute blockRole="submitter"><PropertyNotification /></ProtectedRoute>} />	

			<Route path="/property-notifications/:id" element={<ProtectedRoute blockRole="submitter"><PropertyNotificationDetail /></ProtectedRoute>} />



          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;
