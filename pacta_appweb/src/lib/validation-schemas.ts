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

const contractTypeEnum = [
  'compraventa',
  'suministro',
  'permuta',
  'donacion',
  'deposito',
  'prestacion_servicios',
  'agencia',
  'comision',
  'consignacion',
  'comodato',
  'arrendamiento',
  'leasing',
  'cooperacion',
  'administracion',
  'transporte',
  'otro',
] as const;

const contractStatusEnum = [
  'active',
  'expired',
  'pending',
  'cancelled',
] as const;

const renewalTypeEnum = [
  'none',
  'auto',
  'manual',
] as const;

export const contractSchema = z.object({
  contract_number: z.string().min(1, 'Contract number is required').max(255),
  client_id: z.number().int().positive('Client ID must be a positive number'),
  supplier_id: z.number().int().positive('Supplier ID must be a positive number'),
  client_signer_id: z.number().int().positive().optional().nullable(),
  supplier_signer_id: z.number().int().positive().optional().nullable(),
  start_date: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    { message: 'Start date must be a valid ISO date' }
  ),
  end_date: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    { message: 'End date must be a valid ISO date' }
  ),
  amount: z.number().min(0, 'Amount must be greater than or equal to 0'),
  type: z.enum(contractTypeEnum),
  status: z.enum(contractStatusEnum),
  description: z.string().max(5000).optional(),
  object: z.string().max(2000).optional(),
  fulfillment_place: z.string().max(1000).optional(),
  dispute_resolution: z.string().max(1000).optional(),
  has_confidentiality: z.boolean(),
  guarantees: z.string().max(2000).optional(),
  renewal_type: z.enum(renewalTypeEnum).optional(),
});
