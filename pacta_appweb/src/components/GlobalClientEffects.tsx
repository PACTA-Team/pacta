import { useEffect } from 'react';
import { contractsAPI } from '@/lib/contracts-api';
import { generateNotifications } from '@/lib/notifications';

export default function GlobalClientEffects() {
  useEffect(() => {
    const generate = async () => {
      try {
        const contracts = await contractsAPI.list();
        await generateNotifications(contracts);
      } catch {
        // Silently fail - notifications are non-critical
      }
    };
    generate();

    const interval = setInterval(generate, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // This component doesn't render anything
  return null;
}
