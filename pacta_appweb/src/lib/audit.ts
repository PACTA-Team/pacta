import { auditAPI, AuditLogEntry } from '@/lib/audit-api';

export const getContractAuditLogs = async (contractId: number): Promise<AuditLogEntry[]> => {
  return auditAPI.listByContract(contractId);
};
