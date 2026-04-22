
export type UserRole = 'admin' | 'manager' | 'editor' | 'viewer';

export type ContractStatus = 'active' | 'expired' | 'pending' | 'cancelled';

export type ContractType =
  | 'compraventa'
  | 'suministro'
  | 'permuta'
  | 'donacion'
  | 'deposito'
  | 'prestacion_servicios'
  | 'agencia'
  | 'comision'
  | 'consignacion'
  | 'comodato'
  | 'arrendamiento'
  | 'leasing'
  | 'cooperacion'
  | 'administracion'
  | 'transporte'
  | 'otro';

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  compraventa: 'Compraventa',
  suministro: 'Suministro',
  permuta: 'Permuta',
  donacion: 'Donación',
  deposito: 'Depósito',
  prestacion_servicios: 'Prestación de Servicios',
  agencia: 'Agencia',
  comision: 'Comisión',
  consignacion: 'Consignación',
  comodato: 'Comodato',
  arrendamiento: 'Arrendamiento',
  leasing: 'Leasing',
  cooperacion: 'Cooperación',
  administracion: 'Administración',
  transporte: 'Transporte',
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
  company_id?: string;
  last_access: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  reu_code: string;
  contacts: string;
  document_url?: string;
  document_key?: string;
  document_name?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  address: string;
  reu_code: string;
  contacts: string;
  document_url?: string;
  document_key?: string;
  document_name?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorizedSigner {
  id: string;
  company_id: string;
  company_type: 'client' | 'supplier';
  first_name: string;
  last_name: string;
  position: string;
  phone: string;
  email: string;
  document_url?: string;
  document_key?: string;
  document_name?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: number;
  internal_id: string;
  contract_number: string;
  title?: string;
  client_id: number;
  supplier_id: number;
  company_id: number;
  client_name?: string;   // Nombre del cliente para display en reportes
  supplier_name?: string;  // Nombre del proveedor para display en reportes
  client_signer_id: number | null;
  supplier_signer_id: number | null;
  start_date: string;
  end_date: string;
  amount: number;
  type: ContractType;
  status: ContractStatus;
  description?: string;
  object?: string;
  fulfillment_place?: string;
  dispute_resolution?: string;
  has_confidentiality?: boolean;
  guarantees?: string;
  renewal_type?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export type RenewalType = 'automatica' | 'manual' | 'cumplimiento';

export const RENEWAL_TYPE_LABELS: Record<RenewalType, string> = {
  automatica: 'Prórroga automática',
  manual: 'Renovación por acuerdo expreso',
  cumplimiento: 'Expira al cumplirse obligaciones',
};

export type ModificationType = 'modificacion' | 'prorroga' | 'concrecion';

export const ModificationTypeLabels: Record<ModificationType, string> = {
  modificacion: 'Modificación de cláusulas',
  prorroga: 'Prórroga de vigencia',
  concrecion: 'Concretización de contenido',
};

export interface Supplement {
  id: number;
  internal_id: string;
  contract_id: number;
  supplement_number: string;
  description: string | null;
  effective_date: string;
  modifications: string | null;
  modification_type: ModificationType | null;
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
  modification_type?: ModificationType;
  client_signer_id?: number;
  supplier_signer_id?: number;
}

export interface UpdateSupplementRequest {
  contract_id?: number;
  supplement_number?: string;
  description?: string;
  effective_date?: string;
  modifications?: string;
  modification_type?: ModificationType;
  status?: SupplementStatus;
  client_signer_id?: number;
  supplier_signer_id?: number;
}

export interface Document {
  id: number;
  entity_id: number;
  entity_type: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  entity_id: number | null;
  entity_type: string | null;
  read_at: string | null;
  created_at: string;
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
