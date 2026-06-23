import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHasPermission } from '../utils/roles';

const NoPermission = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center max-w-md px-6">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">Access Denied</h2>
      <p className="text-gray-500">You don't have permission to access this page. Please contact your administrator if you believe this is a mistake.</p>
      <Link to="/" className="inline-block mt-4 text-blue-600 hover:text-blue-800 font-medium hover:underline">
        Go to Dashboard
      </Link>
    </div>
  </div>
);

const ProtectedRoute = ({
  children,
  requirePermission = null,
  blockRole = null,
}) => {
  const { isAuthenticated, loading, can, user } = useAuth();
  const userType = user?.userType;
  // console.log('requirePermission : ',requirePermission)

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

  if (!useHasPermission(requirePermission) && requirePermission) {
    return <NoPermission />;
  }

  return children;
};

export default ProtectedRoute;



// import { Navigate } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext';
// import { getCanonicalRole } from '../utils/roles';

// const ProtectedRoute = ({
//   children,
//   requirePermission = null,
//   blockRole = null,
// }) => {
//   const { isAuthenticated, loading, can, user } = useAuth();

//   if (loading) {
//     return (
//       <div className="bg-app min-h-screen flex items-center justify-center">
//         <div className="flex flex-col items-center gap-4">
//           <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
//           <p className="text-sm text-gray-500 font-medium">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }

//   // Redirect to login if not authenticated
//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }

//   // Block specific roles if specified
//   if (blockRole && user) {
//     const role = getCanonicalRole(user.userType);
//     if (role === blockRole) {
//       return <Navigate to="/login" replace />;
//     }
//   }

//   // Check for required permissions
//   if (requirePermission && !can(requirePermission)) {
//     return <Navigate to="/login" replace />;
//   }

//   return children;
// };

// export default ProtectedRoute;
