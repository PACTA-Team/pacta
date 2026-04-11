import { z } from 'zod';

export const adminSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const partySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  address: z.string().optional().or(z.literal('')),
  reu_code: z.string().optional().or(z.literal('')),
  contacts: z.string().optional().or(z.literal('')),
});

export type AdminFormData = z.infer<typeof adminSchema>;
export type PartyFormData = z.infer<typeof partySchema>;
