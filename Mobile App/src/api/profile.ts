import { api } from './client';
import type { AuthUser } from '@/types';

/**
 * Flat shape the web client (submitter-frontend) uses for /profile/me and
 * /profile/update. The backend stores split firstName/lastName + a nested
 * address object. Some legacy submitters may have a combined `name` instead.
 */
export interface ProfileResponse {
  email: string;
  firstName?: string;
  lastName?: string;
  /** Combined name fallback (older accounts) */
  name?: string;
  phone?: string;
  userType?: string;
  role?: string;
  acquisitionSpecialist?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  profileImage?: string;
  Access?: AuthUser['access'];
  access?: AuthUser['access'];
}

/**
 * The backend stores fields in DynamoDB-cased form (`Email`, `FirstName`,
 * `LastName`, `Phone`, `Address`). Different endpoints normalize this
 * inconsistently — some return lowercase, some pass the raw DynamoDB item
 * through. We normalize to lowercase here so the rest of the app doesn't care.
 */
function normalizeProfile(raw: any): ProfileResponse {
  if (!raw || typeof raw !== 'object') return raw;
  const addr = raw.address ?? raw.Address;
  return {
    ...raw,
    email: raw.email ?? raw.Email,
    firstName: raw.firstName ?? raw.FirstName,
    lastName: raw.lastName ?? raw.LastName,
    name: raw.name ?? raw.Name,
    phone: raw.phone ?? raw.Phone,
    userType: raw.userType ?? raw.UserType,
    acquisitionSpecialist: raw.acquisitionSpecialist ?? raw.AcquisitionSpecialist,
    profileImage: raw.profileImage ?? raw.ProfileImage,
    address: addr
      ? {
          street: addr.street ?? addr.Street,
          city: addr.city ?? addr.City,
          state: addr.state ?? addr.State,
          zip: addr.zip ?? addr.Zip ?? addr.ZIP,
        }
      : undefined,
  };
}

export async function getProfile(): Promise<ProfileResponse> {
  const { data } = await api.get('/profile/me');
  return normalizeProfile(data);
}

export interface ProfileUpdatePayload {
  /**
   * Backend requires email in the payload even though the UI treats it as
   * read-only. Send the current email back unchanged — the web client does
   * the same thing.
   */
  email: string;
  firstName?: string;
  lastName?: string;
  /** Combined name fallback — backend accepts either firstName/lastName or name. */
  name?: string;
  phone?: string;
  acquisitionSpecialist?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  profileImage?: string;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<ProfileResponse> {
  const { data } = await api.put<ProfileResponse>('/profile/update', payload);
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/profile/change-password', { currentPassword, newPassword });
}

export async function checkEmailAvailable(email: string): Promise<{ available: boolean }> {
  const { data } = await api.get('/profile/check-email', { params: { email } });
  return data;
}
