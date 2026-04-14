import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLatestRelease, fetchAllReleases } from '@/lib/github-api';

const mockRelease = {
  tag_name: 'v0.6.0',
  name: 'Release v0.6.0',
  published_at: '2026-04-10T00:00:00Z',
  body: '## Changes\n- Feature A\n- Feature B',
  html_url: 'https://github.com/mowgliph/pacta/releases/tag/v0.6.0',
  assets: [
    { name: 'pacta_0.6.0_linux_amd64.tar.gz', browser_download_url: 'https://example.com/linux.tar.gz' },
    { name: 'pacta_0.6.0_darwin_universal.tar.gz', browser_download_url: 'https://example.com/macos.tar.gz' },
  ],
};

describe('github-api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchLatestRelease', () => {
    it('returns latest release data from GitHub API', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      });

      const result = await fetchLatestRelease();
      expect(result).toEqual(mockRelease);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/mowgliph/pacta/releases/latest',
        { headers: { Accept: 'application/vnd.github+json' } },
      );
    });

    it('uses cached result if within TTL', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      });

      await fetchLatestRelease();
      await fetchLatestRelease();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('returns null on API failure', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchLatestRelease();
      expect(result).toBeNull();
    });
  });

  describe('fetchAllReleases', () => {
    it('returns array of releases', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockRelease]),
      });

      const result = await fetchAllReleases();
      expect(result).toEqual([mockRelease]);
    });

    it('returns empty array on failure', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const result = await fetchAllReleases();
      expect(result).toEqual([]);
    });
  });
});
