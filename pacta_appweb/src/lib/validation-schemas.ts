import { z } from 'zod';

export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128)
  .refine(p => /[A-Z]/.test(p), 'Must contain at least one uppercase letter')
  .refine(p => /[a-z]/.test(p), 'Must contain at least one lowercase letter')
  .refine(p => /[0-9]/.test(p), 'Must contain at least one number')
  .refine(p => /[^A-Za-z0-9]/.test(p), 'Must contain at least one special character');

export const registerSchema = z.object({
  name: z.string().min(1).max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, hyphens, and underscores'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const createExampleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const updateExampleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});
