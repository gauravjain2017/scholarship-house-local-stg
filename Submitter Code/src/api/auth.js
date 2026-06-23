import apiClient from './client';

/**
 * Submit self-registration request (pending approval)
 */
export const submitRegistrationRequest = async ({
  email,
  firstName,
  lastName,
  phone,
  password,
  userType,
  acquisitionSpecialist,
}) => {
  const { data } = await apiClient.post('/auth/register-request', {
    email,
    firstName,
    lastName,
    phone,
    password,
    userType,
    acquisitionSpecialist,
  });

  return data;
};

/**
 * Register a new submitter (DynamoDB)
 */
export const submitterRegister = async ({
  name,
  email,
  phone,
  acquisitionSpecialist,
  password,
  role,
  userType,
}) => {
  const { data } = await apiClient.post('/submitters/register', {
    Name: name,
    Email: email,
    Phone: phone,
    acquisitionSpecialist: acquisitionSpecialist,
    Password: password,
    Role: role,
    UserType: userType,
  });
  return data;
};

export const authAPI = {
  submitterRegister,
  submitterLogin: async (email, password, type) => {
    const { data } = await apiClient.post('/submitters/login', {
      email,
      password,
      type, // forwarded so the backend can enforce role-based login
    });

    if (data.token) {
      localStorage.setItem('token', data.token);
    } else {
      console.error('❌ submitterLogin returned no token', data);
    }

    // Store session token for single-session enforcement
    if (data.sessionToken) {
      localStorage.setItem('sessionToken', data.sessionToken);
    }

    return data;
  },

  /**
   * Logout submitter - invalidates session token on server
   */
  submitterLogout: async () => {
    try {
      await apiClient.post('/submitters/logout');
    } catch (err) {
      // Don't throw on logout failure - we still want to clear local state
      console.warn('Logout API call failed:', err.message);
    }
    // Clear local storage regardless of API success
    localStorage.removeItem('token');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('submitterUser');
  },

  /**
   * Register a new user
   */
  register: async (userData) => {
    const { data } = await apiClient.post('/auth/register', userData);
    return data;
  },

  submitRegistrationRequest,

  getPendingRegistrations: async () => {
    const { data } = await apiClient.get('/admin/pending-registrations');
    return data;
  },

  approveRegistration: async (email) => {
    const { data } = await apiClient.post('/admin/approve-registration', {
      email,
    });
    return data;
  },

  rejectRegistration: async (email) => {
    const { data } = await apiClient.post('/admin/reject-registration', {
      email,
    });
    return data;
  },

  getPublicRoles: async (portalType = 'submitter') => {
    const { data } = await apiClient.get('/auth/public-roles', {
      params: { portal_type: portalType },
    });
    return data;
  },

  /**
   * Get current user profile
   */
  getProfile: async () => {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },
  /**
   * Update user profile
   */
  updateProfile: async (updates) => {
    const { data } = await apiClient.put('/auth/me', updates);
    return data;
  },
};
