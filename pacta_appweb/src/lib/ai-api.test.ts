import { describe, it, expect } from 'vitest';
import { aiAPI } from './ai-api';

describe('aiAPI', () => {
  it('should have generateContract method', () => {
    expect(typeof aiAPI.generateContract).toBe('function');
  });

  it('should have reviewContract method', () => {
    expect(typeof aiAPI.reviewContract).toBe('function');
  });

  it('should have testConnection method', () => {
    expect(typeof aiAPI.testConnection).toBe('function');
  });
});
