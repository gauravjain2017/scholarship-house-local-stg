import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { formatPhoneDisplay, unformatPhone } from '../utils/format';
import logoTitleDarkBlue from '../assets/icons/logo-scholarship-house/logo-title-dark-blue.png';
import "../styles/main.css";

const Register = () => {
  const { submitRegistrationRequest } = useAuth();
  const [roles, setRoles] = useState([]);
  const [team_members, setTeamMembers] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    userType: '',
    specialist: '',
  });

  useEffect(() => {
    authAPI.getTeamMembers()
      .then((res) => {
        const data = res || [];
        setTeamMembers(data);
        if (data.length === 1) {
          setFormData((prev) => ({ ...prev, userType: data[0].role_slug }));
        }
      })
      .catch(() => setTeamMembers([]));
  }, []);

  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [specialistOpen, setSpecialistOpen] = useState(false);
  const [specialistSearch, setSpecialistSearch] = useState('');
  const specialistRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (specialistRef.current && !specialistRef.current.contains(e.target)) {
        setSpecialistOpen(false);
        setSpecialistSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.specialist) {
      setError('Please select your College Funding Specialist.');
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
      userType: 'client',
      specialist: formData.specialist,
    });
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="reg-page">

      {/* ══════════ LEFT COLUMN ══════════ */}
      <div className="reg-left">
        {/* solid dark-blue fallback + gradient overlay — no image import needed */}
        <div className="reg-left-overlay" />

        <div className="reg-left-content">
          {/* logo */}
          <div className="reg-brand">
            <img
              src={logoTitleDarkBlue}
              alt="Scholarship House"
              className="reg-brand-logo"
            />
          </div>

          <div className="reg-left-spacer" />
		  

          {/* tagline */}
          <div>
            <h2 className="reg-tagline-heading">
              Plan smarter. Fund <span class="reg-gradient">college with confidence.</span>
            </h2>
            <p className="reg-tagline-sub">
              Join families working with expert College Funding Specialists to
              unlock scholarships, grants, and smarter aid strategies.
            </p>
			
			<div className="reg-features">
  <div className="reg-feature">
    <div className="reg-feature-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z" />
      </svg>
    </div>
    <div>
      <h4>Expert-matched specialists</h4>
      <p>Get paired with the right advisor for your unique situation</p>
    </div>
  </div>

  <div className="reg-feature">
    <div className="reg-feature-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </svg>
    </div>
    <div>
      <h4>Maximize your funding</h4>
      <p>Discover scholarships and aid you may not know about</p>
    </div>
  </div>

  <div className="reg-feature">
    <div className="reg-feature-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 8v6" />
        <path d="M23 11h-6" />
      </svg>
    </div>
    <div>
      <h4>Dedicated support</h4>
      <p>Your specialist is with you every step of the process</p>
    </div>
  </div>
</div>
</div>
   </div>
  </div>

      {/* ══════════ RIGHT COLUMN ══════════ */}
      <div className="reg-right">
        <div className="reg-right-inner">

          {/* mobile-only logo */}
          <div className="reg-mobile-logo">
            <img
              src={logoTitleDarkBlue}
              alt="Scholarship House"
              style={{ height: 70, maxWidth: 160, width: 'auto' }}
            />
          </div>

          <h1 className="reg-heading form-head">Create your account</h1>
          <p className="reg-subheading">Submit a request to access Scholarship House</p>

          {success ? (
            <div className="reg-success">
              <h3>Registration submitted</h3>
              <p>Your request has been sent and is pending admin approval.</p>
              <Link to="/auth/login">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>

              {error && (
                <div className="reg-error">
                  <p>{error}</p>
                </div>
              )}

              {/* ROW 1 — First Name + Last Name */}
              <div className="reg-row">
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="firstName" className="reg-label">First Name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="lastName" className="reg-label">Last Name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ROW 2 — Email + Phone */}
              <div className="reg-row">
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="email" className="reg-label">Email address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="phone" className="reg-label">Phone</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    required
                    placeholder="555 123 4567"
                    value={formatPhoneDisplay(formData.phone)}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: unformatPhone(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* ROW 3 — Specialist full width */}
              <div className="reg-field">
                <label className="reg-label">
                  Select your College Funding Specialist
                </label>
                <div className="reg-select-wrap" ref={specialistRef} style={{ position: 'relative' }}>
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() => { setSpecialistOpen(o => !o); setSpecialistSearch(''); }}
                    style={{
                      width: '100%', textAlign: 'left', background: '#fff',
                      border: '1px solid #d1d5db', borderRadius: 8,
                      padding: '10px 36px 10px 14px', fontSize: 14,
                      color: formData.specialist ? '#1a3a5c' : '#9ca3af',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {formData.specialist
                        ? team_members.find(m => m.email === formData.specialist)
                            ? `${team_members.find(m => m.email === formData.specialist).firstName} ${team_members.find(m => m.email === formData.specialist).lastName}`
                            : 'Select a specialist'
                        : 'Select a specialist'}
                    </span>
                    <svg viewBox="0 0 20 20" width="16" height="16" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="#9ca3af"
                      style={{ transform: specialistOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                      <polyline points="5 8 10 13 15 8" />
                    </svg>
                  </button>

                  {/* Dropdown panel */}
                  {specialistOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                      background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
                      marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
                    }}>
                      {/* Search input */}
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ position: 'relative' }}>
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"
                            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search specialist..."
                            value={specialistSearch}
                            onChange={e => setSpecialistSearch(e.target.value)}
                            style={{
                              width: '100%', padding: '7px 10px 7px 30px', fontSize: 13,
                              border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      {/* Options list */}
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 220, overflowY: 'auto' }}>
                        {team_members
                          .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(specialistSearch.toLowerCase()))
                          .map(member => (
                            <li
                              key={member.email}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, specialist: member.email }));
                                setSpecialistOpen(false);
                                setSpecialistSearch('');
                                setError('');
                              }}
                              style={{
                                padding: '10px 14px', fontSize: 14, cursor: 'pointer',
                                background: formData.specialist === member.email ? '#f0f6ff' : '#fff',
                                color: formData.specialist === member.email ? '#1a3a5c' : '#374151',
                                fontWeight: formData.specialist === member.email ? 600 : 400,
                                borderBottom: '1px solid #f9fafb',
                              }}
                              onMouseEnter={e => { if (formData.specialist !== member.email) e.currentTarget.style.background = '#f9fafb'; }}
                              onMouseLeave={e => { if (formData.specialist !== member.email) e.currentTarget.style.background = '#fff'; }}
                            >
                              {member.firstName} {member.lastName}
                            </li>
                          ))}
                        {team_members.filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(specialistSearch.toLowerCase())).length === 0 && (
                          <li style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                            No specialists found
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* ROW 4 — Password + Confirm */}
              <div className="reg-row" style={{ marginBottom: 20 }}>
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="password" className="reg-label">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Minimum 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="confirmPassword" className="reg-label">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="reg-submit">
  {loading ? (
    'Creating account...'
  ) : (
    <>
      <span>Sign up</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 12H19M19 12L13 6M19 12L13 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  )}
</button>

              {/* Sign in link */}
              <div className="reg-footer">
                <p>
                  Already have an account?{' '}
                  <Link to="/auth/login">Sign in</Link>
                </p>
              </div>

            </form>
          )}
        </div>
      </div>

    </div>
  );
};

export default Register;
