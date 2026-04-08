
import { Contract, Notification } from '@/types';
import { getNotifications, setNotifications, getNotificationSettings } from './storage';

export const generateNotifications = (contracts: Contract[]): void => {
  const settings = getNotificationSettings();
  if (!settings.enabled) return;

  const notifications = getNotifications();
  const now = new Date();

  contracts.forEach(contract => {
    if (contract.status !== 'active') return;

    const endDate = new Date(contract.endDate);
    const daysUntilExpiration = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    settings.thresholds.forEach(threshold => {
      if (daysUntilExpiration === threshold) {
        const existingNotification = notifications.find(
          n => n.contractId === contract.id && n.type === `expiration_${threshold}` as Notification['type']
        );

        if (!existingNotification) {
          const newNotification: Notification = {
            id: Date.now().toString() + Math.random(),
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            contractTitle: contract.title,
            type: `expiration_${threshold}` as Notification['type'],
            message: `Contract "${contract.title}" (${contract.contractNumber}) will expire in ${threshold} days`,
            status: 'unread',
            createdAt: new Date().toISOString(),
          };
          notifications.push(newNotification);
        }
      }
    });
  });

  setNotifications(notifications);
};

export const markNotificationAsRead = (notificationId: string): void => {
  const notifications = getNotifications();
  const updated = notifications.map(n =>
    n.id === notificationId
      ? { ...n, status: 'read' as const, readAt: new Date().toISOString() }
      : n
  );
  setNotifications(updated);
};

export const markNotificationAsAcknowledged = (notificationId: string): void => {
  const notifications = getNotifications();
  const updated = notifications.map(n =>
    n.id === notificationId
      ? { ...n, status: 'acknowledged' as const, readAt: new Date().toISOString() }
      : n
  );
  setNotifications(updated);
};
