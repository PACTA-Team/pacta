
import { useEffect } from 'react';
import { contractsAPI } from '@/lib/contracts-api';
import { generateNotifications } from '@/lib/notifications';

export default function GlobalClientEffects() {
  useEffect(() => {
    // Generate notifications on app load
    const generate = async () => {
      try {
        const contracts = await contractsAPI.list();
        generateNotifications(contracts);
      } catch {
        // Silently fail - notifications are non-critical
      }
    };
    generate();

    // Set up periodic notification generation (every hour)
    const interval = setInterval(generate, 60 * 60 * 1000); // 1 hour

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // This component doesn't render anything
  return null;
}