// Global test setup
import { vi } from 'vitest';
import { webcrypto } from 'node:crypto';

// Polyfill crypto.randomUUID for Node.js test environment
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto;
}
