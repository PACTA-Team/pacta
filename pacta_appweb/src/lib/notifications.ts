import { notificationsAPI } from '@/lib/notifications-api';
import { notificationSettingsAPI } from '@/lib/notification-settings-api';

const DEFAULT_THRESHOLDS = [7, 14, 30];

export const generateNotifications = async (contracts: any[]): Promise<void> => {
  let settings: { enabled: boolean; thresholds: number[] };
  try {
    const s = await notificationSettingsAPI.get();
    settings = {
      enabled: s.enabled,
      thresholds: typeof s.thresholds === 'string' ? JSON.parse(s.thresholds) : s.thresholds,
    };
  } catch {
    settings = { enabled: true, thresholds: DEFAULT_THRESHOLDS };
  }

  if (!settings.enabled) return;

  const now = new Date();

  for (const contract of contracts) {
    if (contract.status !== 'active') continue;

    const endDate = new Date(contract.end_date);
    const daysUntilExpiration = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    for (const threshold of settings.thresholds) {
      if (daysUntilExpiration === threshold) {
        try {
          await notificationsAPI.create({
            type: `expiration_${threshold}`,
            title: `Contract Expiring: ${contract.title}`,
            message: `Contract "${contract.title}" (${contract.contract_number}) will expire in ${threshold} days`,
            entity_id: contract.id,
            entity_type: 'contract',
          });
        } catch {
          // Silently skip duplicate or failed notification
        }
      }
    }
  }
};

export const markNotificationAsRead = async (notificationId: number): Promise<void> => {
  await notificationsAPI.markRead(notificationId);
};

export const markNotificationAsAcknowledged = async (notificationId: number): Promise<void> => {
  await notificationsAPI.markRead(notificationId);
};
