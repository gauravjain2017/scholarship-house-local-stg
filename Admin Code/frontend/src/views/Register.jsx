import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatPhoneDisplay, unformatPhone } from '../utils/format';
import logoTitleDarkBlue from '../assets/icons/logo-scholarship-house/logo-title-dark-blue.png';

const Register = () => {
  const { submitRegistrationRequest } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    userType: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.userType) {
      setError('Please select why you want to use this application.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    const digitsOnly = formData.phone.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 12) {
      setError('Phone number must be between 8 and 12 digits');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const result = await submitRegistrationRequest({
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      userType: formData.userType,
    });

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-[#EAF4FF] py-12 px-4">
      <div className="max-w-lg w-full bg-surface/95 backdrop-blur-sm border rounded-2xl shadow-xl px-8 pt-10 pb-14">
        <div className="flex flex-col items-center mb-6">
          <img
            src={logoTitleDarkBlue}
            alt="Scholarship House"
            className="h-18 max-w-[160px] w-auto mb-2"
          />
        </div>

        <div>
          <h2 className="text-center text-3xl font-bold text-[#072B53]">
            Create your account
          </h2>
          <p className="text-center text-gray-500 mt-1 mb-8">
            Submit a request to access Scholarship House
          </p>
        </div>
        {success ? (
          <div className="rounded-xl bg-green-50 p-8 text-center">
            <h3 className="text-xl font-semibold text-[#072B53]">
              Registration submitted
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              Your request has been sent and is pending admin approval.
            </p>
            <Link
              to="/auth/login"
              className="mt-6 inline-block font-medium text-[#1E7AC0] hover:underline"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  placeholder="555 123 4567"
                  className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                  value={formatPhoneDisplay(formData.phone)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: unformatPhone(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="userType"
                  className="block text-sm font-medium text-gray-700"
                >
                  Why do you want to use this application?
                </label>
                <select
                  id="userType"
                  name="userType"
                  required
                  value={formData.userType}
                  onChange={handleChange}
                  className="
    mt-1 block w-full
    px-4 py-3
    border border-gray-200
    rounded-lg bg-surface/90
    text-gray-900
    focus:outline-none
    focus:ring-2 focus:ring-accent
    focus:border-transparent
    transition
    sm:text-sm
  "
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                 
				   <option value="team_member">I am a Scholarship House Team Member</option>
                  <option value="admin">I am a Scholarship House Admin</option>
				  
                  {/* <option value="real_estate_professional">
                    I am a real estate professional.
                  </option>
                  <option value="wholesaler">I am a wholesaler.</option>
                  <option value="realtor">I am a realtor.</option>
                  <option value="bird_dogger">I am a bird dogger.</option> */}
                </select>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E7AC0] focus:border-transparent transition"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#1E7AC0] hover:bg-[#1667A8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0AAFE5] transition disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Sign up'}
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  to="/auth/login"
                  className="font-medium text-[#1E7AC0] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Register;
