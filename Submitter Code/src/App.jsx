import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navigation from './components/Navigation';
import Homepage from './views/Homepage';
import SubmitterView from './views/SubmitterView';
import Login from './views/Login';
import Register from './views/Register';
import Profile from './views/Profile';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import MyProperties from './components/submitter/MyProperties';
import SubmitterHomePage from './views/SubmitterHomePage';
import DealDetailPage from './views/DealDetailView';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


/* Redirects already-logged-in users away from auth pages to /dashboard */
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

/* Shows sidebar layout for admins (with header), header-only nav for all other roles */
const RoleLayout = () => {
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
          <Route path="/" element={<SubmitterHomePage />} />
          {/* ── Auth routes (no nav) ── */}

          <Route path="/auth/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/auth/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/auth/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

          <Route path="/auth/reset-password/:token" element={<ResetPassword />} />

          {/* ── Protected routes — layout decided by RoleLayout ── */}
          <Route element={<ProtectedRoute><RoleLayout /></ProtectedRoute>}>
            <Route path="/my-properties" element={<ProtectedRoute requirePermission="CAN_SUBMIT"><MyProperties /></ProtectedRoute>} />
            <Route path="/dashboard" element={<Homepage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/deal-details/:dealId" element={<ProtectedRoute><DealDetailPage /></ProtectedRoute>} />
            <Route path="/submit" element={<ProtectedRoute requirePermission="CAN_SUBMIT"><SubmitterView /></ProtectedRoute>} />

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
