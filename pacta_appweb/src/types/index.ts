
export type UserRole = 'admin' | 'manager' | 'editor' | 'viewer';

export type ContractStatus = 'active' | 'expired' | 'pending' | 'cancelled';

export type ContractType = 
  | 'compraventa' 
  | 'suministro' 
  | 'prestacion_servicios' 
  | 'agencia' 
  | 'comision' 
  | 'consignacion' 
  | 'arrendamiento' 
  | 'leasing' 
  | 'transporte' 
  | 'construccion' 
  | 'cooperacion' 
  | 'otro';

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  compraventa: 'Compraventa',
  suministro: 'Suministro',
  prestacion_servicios: 'Prestación de Servicios',
  agencia: 'Agencia',
  comision: 'Comisión',
  consignacion: 'Consignación',
  arrendamiento: 'Arrendamiento',
  leasing: 'Leasing',
  transporte: 'Transporte',
  construccion: 'Construcción',
  cooperacion: 'Cooperación',
  otro: 'Otro',
};

export type SupplementStatus = 'draft' | 'approved' | 'active';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastAccess: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  reuCode: string;
  contacts: string;
  documentUrl?: string;
  documentKey?: string;
  documentName?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  address: string;
  reuCode: string;
  contacts: string;
  documentUrl?: string;
  documentKey?: string;
  documentName?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizedSigner {
  id: string;
  companyId: string;
  companyType: 'client' | 'supplier';
  firstName: string;
  lastName: string;
  position: string;
  phone: string;
  email: string;
  documentUrl?: string;
  documentKey?: string;
  documentName?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  internalId: string;
  contractNumber: string;
  title?: string;
  clientId: string;
  supplierId: string;
  client?: string;
  supplier?: string;
  clientSignerId: string;
  supplierSignerId: string;
  startDate: string;
  endDate: string;
  amount: number;
  type: ContractType;
  status: ContractStatus;
  description: string;
  object?: string;
  fulfillmentPlace?: string;
  disputeResolution?: string;
  hasConfidentiality?: boolean;
  guarantees?: string;
  renewalType?: RenewalType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RenewalType = 'automatica' | 'manual' | 'cumplimiento';

export const RENEWAL_TYPE_LABELS: Record<RenewalType, string> = {
  automatica: 'Prórroga automática',
  manual: 'Renovación por acuerdo expreso',
  cumplimiento: 'Expira al cumplirse obligaciones',
};

export interface Supplement {
  id: number;
  internal_id: string;
  contract_id: number;
  supplement_number: string;
  description: string | null;
  effective_date: string;
  modifications: string | null;
  status: SupplementStatus;
  client_signer_id: number | null;
  supplier_signer_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplementRequest {
  contract_id: number;
  supplement_number: string;
  description?: string;
  effective_date: string;
  modifications?: string;
  client_signer_id?: number;
  supplier_signer_id?: number;
}

export interface UpdateSupplementRequest {
  contract_id?: number;
  supplement_number?: string;
  description?: string;
  effective_date?: string;
  modifications?: string;
  status?: SupplementStatus;
  client_signer_id?: number;
  supplier_signer_id?: number;
}

export interface Document {
  id: number;
  entityId: number;
  entityType: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string | null;
  entityId: number | null;
  entityType: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  previous_state: string | null;
  new_state: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];
  recipients: string[];
}

export interface Company {
  id: number;
  name: string;
  address?: string;
  tax_id?: string;
  company_type: 'single' | 'parent' | 'subsidiary';
  parent_id?: number;
  parent_name?: string;
  created_at: string;
  updated_at: string;
}

export interface UserCompany {
  user_id: number;
  company_id: number;
  company_name: string;
  is_default: boolean;
}
