const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'PACTA-Team';
const REPO_NAME = 'pacta';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_LATEST = 'pacta_gh_latest';
const CACHE_KEY_ALL = 'pacta_gh_all';

export interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (response.ok) return response;
      if (response.status === 403) {
        // Rate limited — wait and retry
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      return null;
    } catch {
      if (i === retries - 1) return null;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

export async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const cached = getCached<GitHubRelease>(CACHE_KEY_LATEST);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
  );
  if (!response) return null;

  try {
    const data: GitHubRelease = await response.json();
    setCache(CACHE_KEY_LATEST, data);
    return data;
  } catch {
    return null;
  }
}

export async function fetchAllReleases(): Promise<GitHubRelease[]> {
  const cached = getCached<GitHubRelease[]>(CACHE_KEY_ALL);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`,
  );
  if (!response) return [];

  try {
    const data: GitHubRelease[] = await response.json();
    setCache(CACHE_KEY_ALL, data);
    return data;
  } catch {
    return [];
  }
}

/** Extract team commentary from release body */
export function extractTeamCommentary(body: string): string | null {
  const match = body.match(/<!-- team-comment -->([\s\S]*?)<!-- \/team-comment -->/);
  return match ? match[1].trim() : null;
}

/** Strip team commentary from display body */
export function stripTeamCommentary(body: string): string {
  return body.replace(/<!-- team-comment -->[\s\S]*?<!-- \/team-comment -->/g, '').trim();
}
