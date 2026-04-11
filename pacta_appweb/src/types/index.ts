
export type UserRole = 'admin' | 'manager' | 'editor' | 'viewer';

export type ContractStatus = 'active' | 'expired' | 'pending' | 'cancelled';

export type ContractType = 'service' | 'purchase' | 'lease' | 'partnership' | 'employment' | 'other';

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
  title: string;
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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

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
  id: string;
  contractId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  fileKey: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Notification {
  id: string;
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  type: 'expiration_30' | 'expiration_15' | 'expiration_7';
  message: string;
  status: 'unread' | 'read' | 'acknowledged';
  createdAt: string;
  readAt?: string;
}

export interface AuditLog {
  id: string;
  contractId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];
  recipients: string[];
}
