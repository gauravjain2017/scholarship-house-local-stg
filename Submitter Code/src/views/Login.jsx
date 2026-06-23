import { useState, useRef, useEffect } from 'react';
import { FaEye, FaEyeSlash } from '../components/PasswordIcons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import logoTitleDarkBlue from '../assets/icons/logo-scholarship-house/logo-title-dark-blue.png';

const Login = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { submitterLogin, sessionError, clearSessionError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  // Initialize error from sessionError or sessionStorage (e.g., user was logged out from another device and redirected)
  const [error, setError] = useState(
    () => sessionError || sessionStorage.getItem('sessionExpiredMessage') || ''
  );
  const [correctPortalUrl, setCorrectPortalUrl] = useState('');
  const [correctPortalName, setCorrectPortalName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);

  // This login page is the submitter portal — hardcode the type.
  // A separate client / admin login page would hardcode its own value.
  const LOGIN_TYPE = 'submitter';

  // Clear session error and persisted message on mount after displaying
  useEffect(() => {
    if (sessionError) {
      clearSessionError();
    }
    sessionStorage.removeItem('sessionExpiredMessage');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setCorrectPortalUrl('');
    setCorrectPortalName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await submitterLogin(
      formData.email,
      formData.password,
      LOGIN_TYPE
    );

    // console.log(result);
    // return;


    if (result.success) {
      queryClient.removeQueries({ queryKey: ['favorites'] });
      queryClient.removeQueries({ queryKey: ['publishedDeals'] });
      navigate('/dashboard');
    } else {
      // Handle specific error codes from the backend
      const errorMsg = result.error || 'Email address or password is invalid.';
      const errorCode = result.code;

      if (
        errorCode === 'PENDING_REGISTRATION' ||
        errorMsg.includes('pending approval')
      ) {
        setError(
          'Your registration is pending approval. Please wait for an administrator to approve your account.'
        );
      } else if (
        errorCode === 'REGISTRATION_REJECTED' ||
        errorMsg.includes('not approved')
      ) {
        setError(
          'Your registration was not approved. Please contact support for more information.'
        );
      } else if (
        errorCode === 'ACCOUNT_DEACTIVATED' ||
        errorMsg.includes('deactivated')
      ) {
        setError(
          'Your account has been deactivated. Please contact an administrator.'
        );
      } else if (errorCode === 'SESSION_INVALIDATED') {
        setError(
          'Your session has expired. You may have logged in from another device. Please sign in again.'
        );
      } else if (
        errorCode === 'INVALID_ROLE' ||
        errorMsg.includes('not a submitter') ||
        errorMsg.includes('submitter email')
      ) {
        setError(
          'No submitter account found with this email address. Please use a submitter email to sign in.'
        );
        if (result.correctPortalUrl) {
          setCorrectPortalUrl(result.correctPortalUrl);
          setCorrectPortalName(result.correctPortalName || 'correct portal');
        }
      } else {
        setError('Login failed: ' + errorMsg);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-[#EAF4FF] login-no-scrollbar">
      <div className="max-w-md w-full bg-surface/95 backdrop-blur-sm border rounded-2xl shadow-xl px-8 py-10 transform -translate-y-12">
        <div>
          <div className="flex flex-col items-center mb-6">
            <div className="flex flex-col items-center mb-6">
              <img
                src={logoTitleDarkBlue}
                alt="Scholarship House"
                className="h-18 max-w-[160px] w-auto mb-2"
              />
            </div>
          </div>

          <h2 className="text-center text-3xl font-bold text-primary">
            Welcome back
          </h2>
          <p className="text-center text-gray-500 mt-1 mb-8">
            Sign in to continue to Scholarship House
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">
                {error}
                {correctPortalUrl && (
                  <span>
                    {' '}Please sign in at the{' '}
                    <a
                      href={correctPortalUrl}
                      className="font-semibold underline hover:opacity-75"
                    >
                      {correctPortalName} Portal
                    </a>
                    .
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-1">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                ref={passwordInputRef}
              />
              <button
                type="button"
                tabIndex={0}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#072B53] focus:outline-none"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <div className="flex justify-end mb-4">
            <Link
              to="/auth/forgot-password"
              className="text-sm text-[#1E7AC0] hover:text-[#1667A8] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0AAFE5] transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="text-sm text-center mt-2">
          <div className="relative my-6 pb-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
          </div>
          <div className="text-sm text-center mt-6">
            <span className="text-gray-600">Don&apos;t have an account?</span>{' '}
            <Link
              to="/auth/register"
              className="font-medium text-[#1E7AC0] hover:text-[#1667A8] hover:underline"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
