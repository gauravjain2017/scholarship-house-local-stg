import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from '../components/PasswordIcons';
import { validateResetToken, resetPassword } from '../api/passwordReset';
import logoTitleDarkBlue from '../assets/icons/logo-scholarship-house/logo-title-dark-blue.png';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  // Token validation state
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordInputRef = useRef(null);

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    const levels = [
      { label: 'Very Weak', color: 'bg-red-500' },
      { label: 'Weak', color: 'bg-orange-500' },
      { label: 'Fair', color: 'bg-yellow-500' },
      { label: 'Good', color: 'bg-lime-500' },
      { label: 'Strong', color: 'bg-green-500' },
    ];

    return { score, ...levels[Math.min(score, 4)] };
  };

  const passwordStrength = getPasswordStrength(password);

  // Validate token on mount
  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setTokenError('No reset token provided');
        setValidating(false);
        return;
      }

      try {
        const response = await validateResetToken(token);
        if (response.valid) {
          setTokenValid(true);
          setMaskedEmail(response.email || '');
        } else {
          setTokenError(response.error || 'Invalid or expired token');
        }
      } catch (err) {
        setTokenError(
          err.response?.data?.error ||
            'This password reset link is invalid or has expired.'
        );
      } finally {
        setValidating(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Failed to reset password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-[#EAF4FF]">
        <div className="max-w-md w-full bg-surface/95 backdrop-blur-sm border rounded-2xl shadow-xl px-8 py-10 text-center">
          <div className="animate-spin mx-auto h-12 w-12 border-4 border-[#1E7AC0] border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Validating your reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-[#EAF4FF]">
        <div className="max-w-md w-full bg-surface/95 backdrop-blur-sm border rounded-2xl shadow-xl px-8 py-10 transform -translate-y-12">
          <div className="flex flex-col items-center mb-6">
            <img
              src={logoTitleDarkBlue}
              alt="Scholarship House"
              className="h-18 max-w-[160px] w-auto mb-2"
            />
          </div>

          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">
              Link Invalid or Expired
            </h2>
            <p className="text-gray-600 mb-6">
              {tokenError ||
                'This password reset link is no longer valid. It may have expired or already been used.'}
            </p>
          </div>

          <div className="space-y-3">
            <Link
              to="/auth/forgot-password"
              className="block w-full text-center py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] transition"
            >
              Request New Reset Link
            </Link>
            <Link
              to="/auth/login"
              className="block w-full text-center py-3 px-4 text-sm font-semibold rounded-lg text-[#1E7AC0] bg-[#1E7AC0]/10 hover:bg-[#1E7AC0]/20 transition"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-[#EAF4FF]">
        <div className="max-w-md w-full bg-surface/95 backdrop-blur-sm border rounded-2xl shadow-xl px-8 py-10 transform -translate-y-12">
          <div className="flex flex-col items-center mb-6">
            <img
              src={logoTitleDarkBlue}
              alt="Scholarship House"
              className="h-18 max-w-[160px] w-auto mb-2"
            />
          </div>

          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">
              Password Reset Successful
            </h2>
            <p className="text-gray-600 mb-6">
              Your password has been successfully reset. You can now log in with
              your new password.
            </p>
          </div>

          <button
            onClick={() => navigate('/auth/login')}
            className="w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-[#EAF4FF]">
      <div className="max-w-md w-full bg-surface/95 backdrop-blur-sm border rounded-2xl shadow-xl px-8 py-10 transform -translate-y-12">
        <div className="flex flex-col items-center mb-6">
          <img
            src={logoTitleDarkBlue}
            alt="Scholarship House"
            className="h-18 max-w-[160px] w-auto mb-2"
          />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-primary mb-2">
            Reset Your Password
          </h2>
          {maskedEmail && (
            <p className="text-gray-500">
              Create a new password for <strong>{maskedEmail}</strong>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* New Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition pr-12"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                ref={passwordInputRef}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#072B53] focus:outline-none"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{
                        width: `${(passwordStrength.score / 5) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 min-w-[60px]">
                    {passwordStrength.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use at least 8 characters with a mix of letters, numbers, and
                  symbols.
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className={`block w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition pr-12 ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
                }`}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#072B53] focus:outline-none"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword ? 'Hide password' : 'Show password'
                }
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-600 mt-1">
                Passwords do not match
              </p>
            )}
            {confirmPassword &&
              password === confirmPassword &&
              confirmPassword.length >= 8 && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Passwords match
                </p>
              )}
          </div>

          <button
            type="submit"
            disabled={
              loading || password.length < 8 || password !== confirmPassword
            }
            className="w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0AAFE5] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Resetting Password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className="text-sm text-center mt-6">
          <Link
            to="/auth/login"
            className="font-medium text-[#1E7AC0] hover:text-[#1667A8] hover:underline"
          >
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
