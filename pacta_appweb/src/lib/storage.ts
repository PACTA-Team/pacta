
import type { 
  User, 
  Contract, 
  Supplement, 
  Document, 
  Notification, 
  AuditLog, 
  NotificationSettings,
  Client,
  Supplier,
  AuthorizedSigner
} from '@/types';

const STORAGE_KEYS = {
  USERS: 'pacta_users',
  CONTRACTS: 'pacta_contracts',
  SUPPLEMENTS: 'pacta_supplements',
  DOCUMENTS: 'pacta_documents',
  NOTIFICATIONS: 'pacta_notifications',
  AUDIT_LOGS: 'pacta_audit_logs',
  CURRENT_USER: 'pacta_current_user',
  NOTIFICATION_SETTINGS: 'pacta_notification_settings',
  CLIENTS: 'pacta_clients',
  SUPPLIERS: 'pacta_suppliers',
  AUTHORIZED_SIGNERS: 'pacta_authorized_signers',
};

// Generic storage functions
export const storage = {
  get: <T>(key: string): T[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  set: <T>(key: string, data: T[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  },

  getOne: <T>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  setOne: <T>(key: string, data: T): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  },

  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};

// Users
export const getUsers = (): User[] => storage.get<User>(STORAGE_KEYS.USERS);
export const setUsers = (users: User[]): void => storage.set(STORAGE_KEYS.USERS, users);

// Contracts
export const getContracts = (): Contract[] => storage.get<Contract>(STORAGE_KEYS.CONTRACTS);
export const setContracts = (contracts: Contract[]): void => storage.set(STORAGE_KEYS.CONTRACTS, contracts);

// Supplements
export const getSupplements = (): Supplement[] => storage.get<Supplement>(STORAGE_KEYS.SUPPLEMENTS);
export const setSupplements = (supplements: Supplement[]): void => storage.set(STORAGE_KEYS.SUPPLEMENTS, supplements);

// Documents
export const getDocuments = (): Document[] => storage.get<Document>(STORAGE_KEYS.DOCUMENTS);
export const setDocuments = (documents: Document[]): void => storage.set(STORAGE_KEYS.DOCUMENTS, documents);

// Notifications
export const getNotifications = (): Notification[] => storage.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
export const setNotifications = (notifications: Notification[]): void => storage.set(STORAGE_KEYS.NOTIFICATIONS, notifications);

// Audit Logs
export const getAuditLogs = (): AuditLog[] => storage.get<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
export const setAuditLogs = (logs: AuditLog[]): void => storage.set(STORAGE_KEYS.AUDIT_LOGS, logs);

// Clients
export const getClients = (): Client[] => storage.get<Client>(STORAGE_KEYS.CLIENTS);
export const setClients = (clients: Client[]): void => storage.set(STORAGE_KEYS.CLIENTS, clients);

// Suppliers
export const getSuppliers = (): Supplier[] => storage.get<Supplier>(STORAGE_KEYS.SUPPLIERS);
export const setSuppliers = (suppliers: Supplier[]): void => storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);

// Authorized Signers
export const getAuthorizedSigners = (): AuthorizedSigner[] => storage.get<AuthorizedSigner>(STORAGE_KEYS.AUTHORIZED_SIGNERS);
export const setAuthorizedSigners = (signers: AuthorizedSigner[]): void => storage.set(STORAGE_KEYS.AUTHORIZED_SIGNERS, signers);

// Current User
export const getCurrentUser = (): User | null => storage.getOne<User>(STORAGE_KEYS.CURRENT_USER);
export const setCurrentUser = (user: User | null): void => {
  if (user) {
    storage.setOne(STORAGE_KEYS.CURRENT_USER, user);
  } else {
    storage.remove(STORAGE_KEYS.CURRENT_USER);
  }
};

// Notification Settings
export const getNotificationSettings = (): NotificationSettings => {
  const settings = storage.getOne<NotificationSettings>(STORAGE_KEYS.NOTIFICATION_SETTINGS);
  return settings || { enabled: true, thresholds: [30, 15, 7], recipients: [] };
};

export const setNotificationSettings = (settings: NotificationSettings): void => {
  storage.setOne(STORAGE_KEYS.NOTIFICATION_SETTINGS, settings);
};

// Initialize default admin user if no users exist
export const initializeDefaultUser = (): void => {
  const users = getUsers();
  if (users.length === 0) {
    const defaultAdmin: User = {
      id: '1',
      name: 'Pacta User',
      email: 'admin@pacta.local',
      password: 'pacta123',
      role: 'admin',
      status: 'active',
      lastAccess: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setUsers([defaultAdmin]);
  }
};
