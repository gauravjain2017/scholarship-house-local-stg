import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/passwordReset';
import logoTitleDarkBlue from '../assets/icons/logo-scholarship-house/logo-title-dark-blue.png';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   setError('');
  //   setLoading(true);

  //   try {
  //     const response = await requestPasswordReset(email);
  //     setMaskedEmail(response.email || email);
  //     setSuccess(true);
  //   } catch (err) {
  //     // Handle rate limiting specifically
  //     if (err.response?.status === 429) {
  //       setError('Too many password reset requests. Please try again later.');
  //     } else {
  //       setError(
  //         err.response?.data?.error ||
  //           'Failed to send password reset email. Please try again.'
  //       );
  //     }
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Basic email validation
      if (!email.includes('@') || !email.includes('.')) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      // Pass userType so backend checks only client accounts
      const response = await requestPasswordReset(email, 'client');
      if (response?.success === false) {
        setError('No client account found with this email address.');
        return;
      }

      setMaskedEmail(response.email || email);
      setSuccess(true);

    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many password reset requests. Please try again later.');
      } else {
        setError(
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Failed to send password reset email. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">
              Check Your Email
            </h2>
            <p className="text-gray-600 mb-6">
              If an account exists for <strong>{maskedEmail}</strong>, you will
              receive a password reset link shortly.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              The link will expire in 1 hour. If you don&apos;t see the email,
              check your spam folder.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
              className="w-full py-3 px-4 text-sm font-semibold rounded-lg text-[#1E7AC0] bg-[#1E7AC0]/10 hover:bg-[#1E7AC0]/20 transition"
            >
              Try a different email
            </button>
            <Link
              to="/auth/login"
              className="block w-full text-center py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] transition"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Form state
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
            Forgot Password?
          </h2>
          <p className="text-gray-500">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

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
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
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
                Sending...
              </>
            ) : (
              'Send Reset Link'
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

export default ForgotPassword;
