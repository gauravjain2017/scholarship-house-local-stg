import { api } from './client';
import type { AuthUser, LoginResponse, UserType } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

// The backend's /submitters/login returns a flat object with user fields at the
// top level (token, sessionToken, email, name, userType, phone, address, access).
// The iOS app expects { token, sessionToken, user: {...} }, so we reshape here.
interface FlatLoginResponse {
  token: string;
  sessionToken: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  userType?: string | null;
  address?: unknown;
  /** Backend may return either casing depending on which endpoint variant ran. */
  profileImage?: string | null;
  ProfileImage?: string | null;
  access?: AuthUser['access'];
}



export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<FlatLoginResponse>('/submitters/applogin', payload);
  return {
    token: data.token,
    sessionToken: data.sessionToken,
    user: {
      email: data.email,
      name: data.name ?? null,
      phone: data.phone ?? null,
      userType: data.userType ?? null,
      profileImage: data.profileImage ?? data.ProfileImage ?? null,
      access: data.access ?? undefined,
    },
  };
}

export async function logout(): Promise<void> {
  await api.post('/submitters/logout');
}

export async function getMe(): Promise<AuthUser> {
  // `/auth/me` may pass DynamoDB-cased fields through (`ProfileImage` etc.).
  // Normalise here so callers (and the cached AuthUser) always see lowercase.
  const { data } = await api.get<AuthUser & { ProfileImage?: string | null }>('/auth/me');
  return {
    ...data,
    profileImage: data.profileImage ?? data.ProfileImage ?? null,
  };
}

export interface RegisterRequestPayload {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  userType: UserType;
  /** Assigned College Funding Specialist's email. Required for `client` sign-ups. */
  specialist?: string;
}

export async function requestRegistration(
  payload: RegisterRequestPayload,
): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.post('/auth/register-request', payload);
  return data;
}

/** A College Funding Specialist a new client can be assigned to. */
export interface TeamMember {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * List the team members (specialists) a client can be matched with. Mirrors the
 * web client's `authAPI.getTeamMembers()` — the backend returns submitters whose
 * userType is `team_member`, mapped to `{ email, firstName, lastName }`.
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data } = await api.get<TeamMember[]>('/auth/team-members');
  return Array.isArray(data) ? data : [];
}

export interface RequestOtpResponse {
  success: boolean;
  message?: string;
  email?: string;
  /** How long the emailed code stays valid — drives the countdown timer. */
  expiresInMinutes?: number;
}

export async function requestPasswordReset(email: string): Promise<RequestOtpResponse> {
  // Mobile OTP endpoint: backend looks up the email, infers UserType, emails a
  // 6-digit code valid for 10 minutes, and returns the expiry so the app can
  // run its countdown. Returns 404 for unknown emails so the UI can surface a
  // clear error. The web portals still use the link-based /password/request-reset.
  const { data } = await api.post<RequestOtpResponse>('/password/request-otp', { email });
  return data;
}

export interface VerifyOtpResponse {
  valid: boolean;
  /** Returned only when valid — handed to resetPassword(). */
  token?: string;
  email?: string;
}

export async function verifyResetOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
  // On success the backend returns the internal reset token, which the
  // reset-password screen then exchanges for the actual password change.
  const { data } = await api.post<VerifyOtpResponse>('/password/verify-otp', { email, otp });
  return data;
}

export async function validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
  const { data } = await api.get(`/password/validate-token/${encodeURIComponent(token)}`);
  return data;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/password/reset', { token, newPassword });
}
