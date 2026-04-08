
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
  id: string;
  contractId: string;
  supplementNumber: string;
  description: string;
  effectiveDate: string;
  modifications: string;
  status: SupplementStatus;
  documentUrl?: string;
  documentKey?: string;
  documentName?: string;
  clientSignerId: string;
  supplierSignerId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
