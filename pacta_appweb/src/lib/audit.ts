
import { AuditLog } from '@/types';
import { getAuditLogs, setAuditLogs, getCurrentUser } from './storage';

export const addAuditLog = (contractId: string, action: string, details: string): void => {
  const user = getCurrentUser();
  if (!user) return;

  const log: AuditLog = {
    id: Date.now().toString() + Math.random(),
    contractId,
    userId: user.id,
    userName: user.name,
    action,
    details,
    timestamp: new Date().toISOString(),
  };

  const logs = getAuditLogs();
  setAuditLogs([...logs, log]);
};

export const getContractAuditLogs = (contractId: string): AuditLog[] => {
  const logs = getAuditLogs();
  return logs.filter(log => log.contractId === contractId).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};
