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
import SubmitterAboutPage from './views/SubmitterAboutPage';
import ManageClientAbout from './views/settings/ManageClientAbout';
import ManageSubmitterAbout from './views/settings/ManageSubmitterAbout';
import RolePermissions from './views/RolePermissions';
import CustomerView from './views/CustomerView';
import DealDetailPage from './views/DealDetailView';
import FavoriteProperty from './views/FavoriteProperty';
import Login from './views/Login';
import Register from './views/Register';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import DeactivatedUsers from './views/DeactivatedUsers';
import ManageFilters from './views/settings/ManageFilters';
import ManageRoles from './views/settings/ManageRoles';
import ManageTaxRates from './views/settings/ManageTaxRates';
import ManageClientHome from './views/settings/ManageClientHome';
import ManageSubmitterHome from './views/settings/ManageSubmitterHome';
import MyDisputes from './views/MyDisputes';
import ClaimProperties from './views/ClaimProperties';
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


/* Shows sidebar layout for roles with portal_type=admin, header-only nav for all others */
const RoleLayout = () => {
  const { user, roles } = useAuth();

  const adminPortalSlugs = roles.map((r) => r.role_slug);
  const isAdminPortalUser = user && adminPortalSlugs.length > 0 && adminPortalSlugs.includes(user.role);

 
  return <AppLayout />;
  

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
          <Route path="/submitter-about" element={<SubmitterAboutPage />} />
          <Route path="/settings/client-about" element={<ProtectedRoute requirePermission="settings.manage_client_about_page"><ManageClientAbout /></ProtectedRoute>} />
          <Route path="/settings/submitter-about" element={<ProtectedRoute requirePermission="settings.manage_submitter_about_page"><ManageSubmitterAbout /></ProtectedRoute>} />



          {/* ── Public property view (no auth, no sidebar/header) ── */}
          <Route path="/property/:dealId" element={<PublicPropertyView />} />

          {/* ── Client Home Page (renders saved layout from localStorage) ── */}
          <Route path="/client-home" element={<ClientHomePage />} />
          {/* ── Submitter Home Page (renders saved layout for submitters) ── */}
          <Route path="/submitter-home" element={<SubmitterHomePage />} />

          {/* ── Full-page routes (no sidebar) ── */}
          <Route path="/settings/client-home" element={<ProtectedRoute requirePermission="settings.manage_client_home_page"><ManageClientHome /></ProtectedRoute>} />
          <Route path="/settings/submitter-home" element={<ProtectedRoute requirePermission="settings.manage_submitter_home_page"><ManageSubmitterHome /></ProtectedRoute>} />

          {/* ── Protected routes — layout decided by RoleLayout ── */}
          <Route element={<ProtectedRoute><RoleLayout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/submit" element={<ProtectedRoute requirePermission='submit_property.can_create_property'><SubmitterView /></ProtectedRoute>} />
            {/* <Route path="/my-properties" element={<ProtectedRoute requirePermission="CAN_SUBMIT"><MyProperties /></ProtectedRoute>} /> */}
            {/* <Route path="/admin" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard /></ProtectedRoute>} /> */}
            <Route path="/admin/users" element={<ProtectedRoute requirePermission={["user_management.user_listing", "user_management.own_user_listing"]}><UserManagement defaultTab="users" /></ProtectedRoute>} />

            <Route path="/admin/user/:token" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><UserDetail /></ProtectedRoute>} />
            <Route path="/admin/properties" element={<ProtectedRoute requirePermission="property_management.view_property_listing"><PropertyManagement defaultTab="properties" /></ProtectedRoute>} />
            <Route path="/admin/deactivated-users" element={<ProtectedRoute><DeactivatedUsers /></ProtectedRoute>} />
            {/* <Route path="/admin/submissions" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard defaultTab="submissions" /></ProtectedRoute>} />
          <Route path="/admin/approvals"   element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard defaultTab="approvals" /></ProtectedRoute>} /> */}
            <Route path="/admin/notifications" element={<ProtectedRoute requirePermission="VIEW_ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/notifications" element={<Notification />} />
            <Route path="/notifications/:id" element={<NotificationDetail />} />
            <Route path="/deals" element={<ProtectedRoute requirePermission="browse_property.view_deals" blockRole="submitter"><CustomerView /></ProtectedRoute>} />
            <Route path="/deal-details/:dealId" element={<ProtectedRoute><DealDetailPage /></ProtectedRoute>} />

            <Route path="/settings/filters" element={<ProtectedRoute requirePermission="settings.manage_filters"><ManageFilters /></ProtectedRoute>} />
            
            <Route path="/settings/tax-rates" element={<ManageTaxRates />} />
            {/* ManageClientHome & ManageSubmitterHome moved outside RoleLayout for full-page view */}
            {/* <Route path="/settings" element={<Navigate to="/settings/filters" replace />} /> */}
            <Route path="/favorite-properties" element={<ProtectedRoute requirePermission="favorite_property.can_view_favourite_property" blockRole="submitter"><FavoriteProperty /></ProtectedRoute>} />
            <Route path="/favorite-properties/:dealId" element={<ProtectedRoute requirePermission="favorite_property.can_view_favourite_property" blockRole="submitter"><FavoriteProperty /></ProtectedRoute>} />
            
            <Route path="/property-notifications" element={<ProtectedRoute blockRole="submitter"><PropertyNotification /></ProtectedRoute>} />

            <Route path="/property-notifications/:id" element={<ProtectedRoute blockRole="submitter"><PropertyNotificationDetail /></ProtectedRoute>} />
            <Route path="/manage-roles" element={<ManageRoles />} />
            <Route path="/claim-properties" element={<ProtectedRoute requirePermission="claim_property.can_view_claim_property"><ClaimProperties /></ProtectedRoute>} />

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
