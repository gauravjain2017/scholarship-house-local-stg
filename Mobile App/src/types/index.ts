export type UserType = 'submitter' | 'client' | 'admin' | string;

export interface AuthUser {
  email: string;
  name?: string | null;
  phone?: string | null;
  userType?: UserType | null;
  role?: string;
  /**
   * Public URL of the user's avatar. Cached on the AuthUser so the app header
   * can render it immediately on app launch / re-login, without waiting for
   * `/profile/me` to round-trip.
   */
  profileImage?: string | null;
  access?: {
    priority?: boolean;
    partnership?: boolean;
    turnkey?: boolean;
  };
}

export interface LoginResponse {
  token: string;
  sessionToken: string;
  user: AuthUser;
}

export type DealStatus =
  | 'draft'
  | 'pending'
  | 'published'
  | 'sold'
  | 'expired'
  | 'rejected';

export interface PropertyAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  lat?: number;
  lng?: number;
}

export interface Property {
  id: string;
  title?: string;
  description?: string;
  propertyType?: string;
  price?: number;
  address?: PropertyAddress;
  bedrooms?: number;
  bathrooms?: number;
  area?: number; // sq ft
  /**
   * Backend's Joi schema accepts EITHER a comma-separated string (canonical;
   * what the submitter-frontend writes) OR a string[] (legacy / admin imports).
   * Consumers must coerce — see toChipList / toFreeText in app/properties/[id].tsx.
   */
  amenities?: string | string[];
  /** Free-text description of nearby attractions. Same dual shape as `amenities`. */
  localAttractions?: string | string[];
  status?: DealStatus;
  /** Set when a client claims the property (published/approved → pending). */
  claimedAt?: string | null;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /**
   * Flat backend deal fields (the canonical submitter/admin record shape).
   * The deal record carries many more flat fields than this — most are read via
   * `as any` in the detail view — but these few are referenced from typed code
   * (e.g. `utils/propertyId.ts`), so they're declared here as optional.
   */
  streetAddress?: string;
  postalCode?: string;
  /** Backend-supplied human reference, when present. */
  propertyId?: string;
  referenceId?: string;
  images?: string[]; // S3 URLs
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Draft {
  id: string;
  email: string;
  payload: Partial<Property>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string; // e.g. image/jpeg
  folder?: string; // e.g. 'properties'
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  /**
   * Public S3 URL the backend stores in the deal record.
   *
   * Backend field names differ between endpoints (we cannot change backend):
   *   - POST /upload/presigned-url        → `fileUrl`
   *   - POST /upload/batch-presigned-urls → `publicUrl`
   * Accept both so callers can read either without breaking.
   */
  fileUrl?: string;
  publicUrl?: string;
  key: string;
}
