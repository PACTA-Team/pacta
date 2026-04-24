/**
 * Simple logger wrapper for consistent logging across the application.
 * Provides a single point for future enhancement (e.g., sending logs to a service).
 */
export const logger = {
  error: (...args: Parameters<typeof console.error>) => {
    console.error('[pacta]', ...args);
  },
  warn: (...args: Parameters<typeof console.warn>) => {
    console.warn('[pacta]', ...args);
  },
  info: (...args: Parameters<typeof console.info>) => {
    console.info('[pacta]', ...args);
  },
  debug: (...args: Parameters<typeof console.debug>) => {
    console.debug('[pacta]', ...args);
  },
  log: (...args: Parameters<typeof console.log>) => {
    console.log('[pacta]', ...args);
  },
};

export default logger;
