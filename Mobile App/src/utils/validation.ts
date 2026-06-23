import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    phone: z
      .string()
      .trim()
      .refine((v) => v.replace(/\D/g, '').length === 10, 'Enter a 10-digit phone number'),
    userType: z.enum(['submitter', 'client'], {
      errorMap: () => ({ message: 'Please select an option.' }),
    }),
    // College Funding Specialist (a team member's email). Only relevant for
    // clients — the field is hidden for submitters, and the cross-field rule
    // below makes it required only when userType === 'client'.
    specialist: z.string().trim().optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Min 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.userType !== 'client' || !!(d.specialist && d.specialist.length > 0), {
    path: ['specialist'],
    message: 'Please select your College Funding Specialist.',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

// Profile edit — matches submitter-frontend/views/Profile.jsx ProfileInfoTab.
// Email is read-only (separate field), so it's not in the schema.
export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  // Same rule as registration: exactly 10 digits (formatted "(555) 123-4567").
  phone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, '').length === 10, 'Enter a 10-digit phone number'),
  acquisitionSpecialist: z
    .string()
    .trim()
    .optional()
    .or(z.literal('')),
  // Address is fully optional. If any one field is filled the others can still be blank.
  street: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  zip: z.string().trim().max(20).optional().or(z.literal('')),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const otpSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type OtpInput = z.infer<typeof otpSchema>;

export const resetPasswordSchema = z
  .object({
    // Same complexity rules as registration / change-password so a reset can't
    // set a weaker password than the rest of the app allows.
    password: z
      .string()
      .min(8, 'Min 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const propertySchema = z.object({
  title: z.string().trim().min(3, 'Title is required'),
  description: z.string().trim().min(10, 'Add a longer description').optional().or(z.literal('')),
  propertyType: z.string().min(1, 'Select a property type'),
  price: z.coerce.number().nonnegative('Price must be ≥ 0'),
  street: z.string().trim().min(1, 'Street is required'),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().min(1, 'State is required'),
  country: z.string().trim().min(1, 'Country is required'),
  zip: z.string().trim().min(1, 'ZIP is required'),
  bedrooms: z.coerce.number().int().nonnegative().default(0),
  bathrooms: z.coerce.number().nonnegative().default(0),
  area: z.coerce.number().nonnegative().default(0),
  amenities: z.string().optional().or(z.literal('')),
  contactName: z.string().trim().optional().or(z.literal('')),
  contactEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  contactPhone: z.string().optional().or(z.literal('')),
});
export type PropertyInput = z.infer<typeof propertySchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z
      .string()
      .min(8, 'Min 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
