import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

describe('Storage Module', () => {
  let localStorageMock: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    localStorageMock = mockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return empty array when no data exists', async () => {
      const { storage } = await import('@/lib/storage');
      const result = storage.get('test_key');
      expect(result).toEqual([]);
    });

    it('should return parsed array when data exists', async () => {
      const { storage } = await import('@/lib/storage');
      const testData = [{ id: 1, name: 'test' }, { id: 2, name: 'test2' }];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testData));

      const result = storage.get('test_key');
      expect(result).toEqual(testData);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('test_key');
    });
  });

  describe('set', () => {
    it('should store data as JSON string', async () => {
      const { storage } = await import('@/lib/storage');
      const testData = [{ id: 1, name: 'test' }];

      storage.set('test_key', testData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test_key',
        JSON.stringify(testData)
      );
    });
  });

  describe('getOne', () => {
    it('should return null when no data exists', async () => {
      const { storage } = await import('@/lib/storage');
      const result = storage.getOne('test_key');
      expect(result).toBeNull();
    });

    it('should return parsed object when data exists', async () => {
      const { storage } = await import('@/lib/storage');
      const testData = { id: 1, name: 'test' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testData));

      const result = storage.getOne('test_key');
      expect(result).toEqual(testData);
    });
  });

  describe('setOne', () => {
    it('should store single object as JSON string', async () => {
      const { storage } = await import('@/lib/storage');
      const testData = { id: 1, name: 'test' };

      storage.setOne('test_key', testData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test_key',
        JSON.stringify(testData)
      );
    });
  });
});
