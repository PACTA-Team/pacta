import { auditAPI, AuditLog } from '@/lib/audit-api';

export const getContractAuditLogs = async (contractId: number): Promise<AuditLog[]> => {
  return auditAPI.listByContract(contractId);
};
