import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCanonicalRole } from '../utils/roles';

const ProtectedRoute = ({
  children,
  requirePermission = null,
  blockRole = null,
}) => {
  const { isAuthenticated, loading, can, user } = useAuth();

  if (loading) {
    return (
      <div className="bg-app min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Block specific roles if specified
  if (blockRole && user) {
    const role = getCanonicalRole(user.userType);
    if (role === blockRole) {
      return <Navigate to="/" replace />;
    }
  }

  // Check for required permissions
  if (requirePermission && !can(requirePermission)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
