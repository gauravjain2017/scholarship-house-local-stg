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
import Home from './views/Homepage';
// import PropertyManagement from './views/PropertyManagement11';
import Notification from './views/Notification';
import NotificationDetail from './views/NotificationDetail';
import PropertyNotification from './views/PropertyNotification';
import PropertyNotificationDetail from './views/PropertyNotificationDetail';
import Profile from './views/Profile';
import CustomerView from './views/CustomerView';
import DealDetailPage from './views/DealDetailView';
import FavoriteProperty from './views/FavoriteProperty';
import Login from './views/Login';
import Register from './views/Register';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import PublicPropertyView from './views/PublicPropertyView';
import ClientHomePage from './views/ClientHomePage';
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
  const { hasRole } = useAuth();
  // console.log('hasRole : ',hasRole('team_member'))
  if (hasRole('admin') || hasRole('team_member')) {
    return <AppLayout />;   // sidebar + header layout for admins
  }

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
          <Route path="/" element={<ClientHomePage />} />
          
		  
		<Route path="/auth/login" element={<PublicRoute><Login /></PublicRoute>} />
		<Route path="/auth/register" element={<PublicRoute><Register /></PublicRoute>} />
		<Route path="/auth/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
		<Route path="/auth/reset-password/:token" element={<ResetPassword />} />
		
		
		  
	  <Route path="/property/:dealId" element={<PublicPropertyView />} />
		   <Route element={<ProtectedRoute><RoleLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Home />} />
			 <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notification />} />
            <Route path="/notifications/:id" element={<NotificationDetail />} />
            <Route path="/deals" element={<ProtectedRoute blockRole="submitter"><CustomerView /></ProtectedRoute>} />
            <Route path="/deal-details/:dealId" element={<ProtectedRoute blockRole="submitter"><DealDetailPage /></ProtectedRoute>} />
            <Route path="/favorite-properties" element={<ProtectedRoute blockRole="submitter"><FavoriteProperty /></ProtectedRoute>} />
            <Route path="/favorite-properties/:dealId" element={<ProtectedRoute blockRole="submitter"><FavoriteProperty /></ProtectedRoute>} />
            <Route path="/property-notifications" element={<ProtectedRoute blockRole="submitter"><PropertyNotification /></ProtectedRoute>} />
            <Route path="/property-notifications/:id" element={<ProtectedRoute blockRole="submitter"><PropertyNotificationDetail /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;
