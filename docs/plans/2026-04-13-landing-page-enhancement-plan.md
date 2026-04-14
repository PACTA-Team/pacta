# PACTA Landing Page Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add About, FAQ, Contact sections and Footer to the landing page, plus dedicated Download and Changelog pages with GitHub API integration, professional SEO, and favicon.

**Architecture:** Component-driven approach — new sections added to existing HomePage, two new public routes (`/download`, `/changelog`), shared Footer component, GitHub API wrapper with caching, JSON-LD structured data, and comprehensive meta tags.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion, Lucide React, i18next, Vite

---

### Task 1: i18n Translation Files

**Files:**
- Create: `pacta_appweb/public/locales/en/download.json`
- Create: `pacta_appweb/public/locales/es/download.json`
- Create: `pacta_appweb/public/locales/en/changelog.json`
- Create: `pacta_appweb/public/locales/es/changelog.json`
- Modify: `pacta_appweb/public/locales/en/landing.json` (add about, faq, contact, footer keys)
- Modify: `pacta_appweb/public/locales/es/landing.json` (add about, faq, contact, footer keys)
- Modify: `pacta_appweb/public/locales/en/common.json` (add footer keys)
- Modify: `pacta_appweb/public/locales/es/common.json` (add footer keys)

**Step 1: Create download.json (English)**

```json
{
  "title": "Download PACTA",
  "subtitle": "Get started in minutes",
  "description": "PACTA is a single binary with zero external dependencies. Download for your platform and run locally.",
  "platforms": {
    "linux": {
      "name": "Linux",
      "description": "64-bit Linux (AMD64)",
      "installTitle": "Installation Instructions",
      "installSteps": [
        "Download the .tar.gz file for your architecture",
        "Extract: tar -xzf pacta_*.tar.gz",
        "Move to PATH: sudo mv pacta /usr/local/bin/",
        "Run: pacta"
      ]
    },
    "macos": {
      "name": "macOS",
      "description": "Apple Silicon & Intel (Universal)",
      "installTitle": "Installation Instructions",
      "installSteps": [
        "Download the .tar.gz file",
        "Extract: tar -xzf pacta_*.tar.gz",
        "Move to PATH: sudo mv pacta /usr/local/bin/",
        "Run: pacta"
      ]
    },
    "windows": {
      "name": "Windows",
      "description": "64-bit Windows (AMD64)",
      "installTitle": "Installation Instructions",
      "installSteps": [
        "Download the .zip file",
        "Extract the archive",
        "Move pacta.exe to a folder in your PATH",
        "Run: pacta"
      ]
    }
  },
  "latestVersion": "Latest Version",
  "downloadNow": "Download Now",
  "viewAllReleases": "View All Releases",
  "fetchError": "Unable to fetch latest release info. Check our GitHub releases page.",
  "backToHome": "Back to Home"
}
```

**Step 2: Create download.json (Spanish)**

```json
{
  "title": "Descargar PACTA",
  "subtitle": "Comienza en minutos",
  "description": "PACTA es un único binario sin dependencias externas. Descarga para tu plataforma y ejecuta localmente.",
  "platforms": {
    "linux": {
      "name": "Linux",
      "description": "Linux 64-bit (AMD64)",
      "installTitle": "Instrucciones de Instalación",
      "installSteps": [
        "Descarga el archivo .tar.gz para tu arquitectura",
        "Extrae: tar -xzf pacta_*.tar.gz",
        "Mueve a PATH: sudo mv pacta /usr/local/bin/",
        "Ejecuta: pacta"
      ]
    },
    "macos": {
      "name": "macOS",
      "description": "Apple Silicon e Intel (Universal)",
      "installTitle": "Instrucciones de Instalación",
      "installSteps": [
        "Descarga el archivo .tar.gz",
        "Extrae: tar -xzf pacta_*.tar.gz",
        "Mueve a PATH: sudo mv pacta /usr/local/bin/",
        "Ejecuta: pacta"
      ]
    },
    "windows": {
      "name": "Windows",
      "description": "Windows 64-bit (AMD64)",
      "installTitle": "Instrucciones de Instalación",
      "installSteps": [
        "Descarga el archivo .zip",
        "Extrae el archivo",
        "Mueve pacta.exe a una carpeta en tu PATH",
        "Ejecuta: pacta"
      ]
    }
  },
  "latestVersion": "Última Versión",
  "downloadNow": "Descargar Ahora",
  "viewAllReleases": "Ver Todas las Versiones",
  "fetchError": "No se pudo obtener la información de la última versión. Consulta nuestra página de releases en GitHub.",
  "backToHome": "Volver al Inicio"
}
```

**Step 3: Create changelog.json (English)**

```json
{
  "title": "Changelog",
  "subtitle": "What's new in PACTA",
  "description": "Track every improvement, fix, and feature across PACTA releases.",
  "version": "Version",
  "releasedOn": "Released on",
  "viewOnGitHub": "View on GitHub",
  "teamNotes": "Team Notes",
  "fetchError": "Unable to load changelog. Check our GitHub releases page.",
  "backToHome": "Back to Home",
  "loading": "Loading releases..."
}
```

**Step 4: Create changelog.json (Spanish)**

```json
{
  "title": "Registro de Cambios",
  "subtitle": "Novedades en PACTA",
  "description": "Rastrea cada mejora, corrección y función en las versiones de PACTA.",
  "version": "Versión",
  "releasedOn": "Publicado el",
  "viewOnGitHub": "Ver en GitHub",
  "teamNotes": "Notas del Equipo",
  "fetchError": "No se pudo cargar el registro de cambios. Consulta nuestra página de releases en GitHub.",
  "backToHome": "Volver al Inicio",
  "loading": "Cargando versiones..."
}
```

**Step 5: Update landing.json (English) — add keys**

Add to the existing `landing.json`:

```json
{
  "nav": {
    "features": "Features",
    "login": "Login"
  },
  "about": {
    "title": "About PACTA",
    "description": "PACTA is a local-first Contract Lifecycle Management system built for teams that need full control over their contract data. No cloud dependencies, no third-party databases — just a single binary that runs on your machine.",
    "mission": "Our mission is to make contract management accessible, secure, and completely under your control.",
    "values": {
      "localFirst": {
        "title": "Local-First",
        "description": "Your data stays on your machine. No cloud sync, no external dependencies."
      },
      "openSource": {
        "title": "Open Source",
        "description": "Transparent code, community-driven improvements, auditable security."
      },
      "simplicity": {
        "title": "Simplicity",
        "description": "One binary, zero infrastructure. Deploy in minutes, not days."
      }
    }
  },
  "faq": {
    "title": "Frequently Asked Questions",
    "subtitle": "Everything you need to know about PACTA",
    "items": [
      {
        "question": "What is PACTA?",
        "answer": "PACTA is a Contract Lifecycle Management (CLM) system that runs locally on your machine. It helps you create, track, approve, and manage contracts without relying on any cloud services."
      },
      {
        "question": "Do I need an internet connection?",
        "answer": "No. PACTA runs entirely on your local machine. Once installed, it works offline with no external dependencies."
      },
      {
        "question": "How is my data stored?",
        "answer": "All data is stored in an embedded SQLite database within the application. No external database server is required."
      },
      {
        "question": "Is PACTA free?",
        "answer": "Yes. PACTA is open source and free to use under the MIT License."
      },
      {
        "question": "How do I install PACTA?",
        "answer": "Download the binary for your platform from the Download page, extract it, and run the executable. No installation wizard needed."
      },
      {
        "question": "Who is PACTA for?",
        "answer": "Legal teams, procurement departments, consulting firms, and any organization that needs to manage contracts without cloud dependency."
      }
    ]
  },
  "contact": {
    "title": "Get in Touch",
    "description": "Have questions or want to contribute? We'd love to hear from you.",
    "email": "Contact Us",
    "emailAddress": "pactateam@gmail.com",
    "github": "View on GitHub",
    "githubDesc": "Browse the source code, report issues, or contribute"
  },
  "footer": {
    "tagline": "Local-first Contract Lifecycle Management",
    "links": {
      "download": "Download",
      "changelog": "Changelog",
      "github": "GitHub"
    },
    "copyright": "PACTA is open source under the MIT License."
  }
}
```

**Step 6: Update landing.json (Spanish) — add same keys with Spanish translations**

(Same structure, Spanish translations for all values)

**Step 7: Update common.json (both EN/ES) — add footer keys**

Add to `common.json`:
```json
{
  "footer": {
    "rights": "All rights reserved."
  }
}
```

**Step 8: Commit**

```bash
git add pacta_appweb/public/locales/
git commit -m "feat: add i18n translations for about, faq, contact, footer, download, changelog"
```

---

### Task 2: GitHub API Wrapper

**Files:**
- Create: `pacta_appweb/src/lib/github-api.ts`
- Test: `pacta_appweb/src/__tests__/github-api.test.ts`

**Step 1: Write the failing test**

```typescript
// pacta_appweb/src/__tests__/github-api.test.ts
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
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/mowgliph/pacta/releases/latest');
    });

    it('uses cached result if within TTL', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      });

      await fetchLatestRelease();
      await fetchLatestRelease();

      expect(fetch).toHaveBeenCalledTimes(1); // Second call uses cache
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
```

**Step 2: Run test to verify it fails**

Run: `cd pacta_appweb && npx vitest src/__tests__/github-api.test.ts --run`
Expected: FAIL with "Cannot find module '@/lib/github-api'"

**Step 3: Write implementation**

```typescript
// pacta_appweb/src/lib/github-api.ts

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'mowgliph';
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
```

**Step 4: Run test to verify it passes**

Run: `cd pacta_appweb && npx vitest src/__tests__/github-api.test.ts --run`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add pacta_appweb/src/lib/github-api.ts pacta_appweb/src/__tests__/github-api.test.ts
git commit -m "feat: add GitHub API wrapper with caching and retry logic"
```

---

### Task 3: About Section Component

**Files:**
- Create: `pacta_appweb/src/components/landing/AboutSection.tsx`
- Modify: `pacta_appweb/src/pages/HomePage.tsx` (import and add AboutSection)

**Step 1: Create AboutSection.tsx**

```typescript
// pacta_appweb/src/components/landing/AboutSection.tsx
"use client";

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Shield, Globe, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export function AboutSection() {
  const { t } = useTranslation('landing');

  const values = [
    { icon: Shield, key: 'localFirst' },
    { icon: Globe, key: 'openSource' },
    { icon: Zap, key: 'simplicity' },
  ];

  return (
    <section id="about" className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
            <span className="text-muted-foreground">{t('about.title')}</span>
          </div>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
            {t('about.description')}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground/80">
            {t('about.mission')}
          </p>
        </motion.div>

        {/* Values cards */}
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid gap-6 md:grid-cols-3"
        >
          {values.map(({ icon: Icon, key }) => (
            <motion.div key={key} variants={cardVariants}>
              <Card className="group h-full overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/20">
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{t(`about.values.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`about.values.${key}.description`)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Integrate into HomePage**

Modify `HomePage.tsx` — import and add AboutSection after FeaturesSection:

```typescript
import { AboutSection } from '@/components/landing/AboutSection';
```

In the JSX, after `<FeaturesSection />`:
```tsx
<AboutSection />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/AboutSection.tsx pacta_appweb/src/pages/HomePage.tsx
git commit -m "feat: add About section to landing page"
```

---

### Task 4: FAQ Section Component

**Files:**
- Create: `pacta_appweb/src/components/landing/FaqSection.tsx`
- Modify: `pacta_appweb/src/pages/HomePage.tsx` (import and add FaqSection)

**Step 1: Create FaqSection.tsx**

```typescript
// pacta_appweb/src/components/landing/FaqSection.tsx
"use client";

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function FaqSection() {
  const { t } = useTranslation('landing');

  const faqItems = t('faq.items', { returnObjects: true }) as Array<{
    question: string;
    answer: string;
  }>;

  return (
    <section id="faq" className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-3xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
            <span className="text-muted-foreground">{t('faq.title')}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('faq.subtitle')}
          </h2>
        </motion.div>

        {/* Accordion */}
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <AccordionItem value={`item-${index}`} className="border-b border-border/50">
                <AccordionTrigger className="text-left text-base font-medium">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
```

**Step 2: Integrate into HomePage**

Import and add after AboutSection:
```tsx
<FaqSection />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/FaqSection.tsx pacta_appweb/src/pages/HomePage.tsx
git commit -m "feat: add FAQ accordion section to landing page"
```

---

### Task 5: Contact Section Component

**Files:**
- Create: `pacta_appweb/src/components/landing/ContactSection.tsx`
- Modify: `pacta_appweb/src/pages/HomePage.tsx` (import and add ContactSection)

**Step 1: Create ContactSection.tsx**

```typescript
// pacta_appweb/src/components/landing/ContactSection.tsx
"use client";

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Mail, Github } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ContactSection() {
  const { t } = useTranslation('landing');

  return (
    <section id="contact" className="px-6 py-24 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-2xl text-center"
      >
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
          <span className="text-muted-foreground">{t('contact.title')}</span>
        </div>
        <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {t('contact.title')}
        </h2>
        <p className="mb-10 text-lg text-muted-foreground">
          {t('contact.description')}
        </p>

        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/40">
          <CardContent className="flex flex-col items-center gap-6 pt-8 sm:flex-row sm:justify-center sm:gap-10">
            {/* Email */}
            <a
              href="mailto:pactateam@gmail.com"
              className="group flex flex-col items-center gap-2 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 transition-colors group-hover:from-primary/30">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-medium">{t('contact.email')}</span>
              <span className="text-xs text-muted-foreground">{t('contact.emailAddress')}</span>
            </a>

            {/* GitHub */}
            <a
              href="https://github.com/mowgliph/pacta"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/80 transition-colors group-hover:from-muted/80">
                <Github className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">{t('contact.github')}</span>
              <span className="text-xs text-muted-foreground">{t('contact.githubDesc')}</span>
            </a>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
```

**Step 2: Integrate into HomePage**

Import and add after FaqSection:
```tsx
<ContactSection />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/ContactSection.tsx pacta_appweb/src/pages/HomePage.tsx
git commit -m "feat: add Contact section to landing page"
```

---

### Task 6: Landing Footer Component

**Files:**
- Create: `pacta_appweb/src/components/landing/LandingFooter.tsx`
- Modify: `pacta_appweb/src/pages/HomePage.tsx` (import and add LandingFooter)

**Step 1: Create LandingFooter.tsx**

```typescript
// pacta_appweb/src/components/landing/LandingFooter.tsx
"use client";

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Github } from 'lucide-react';
import { AnimatedLogo } from '@/components/AnimatedLogo';

export function LandingFooter() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  return (
    <footer className="border-t bg-card" role="contentinfo">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Left: Logo + tagline */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 self-start"
              aria-label="Go to home"
            >
              <AnimatedLogo size="sm" animate={false} />
              <span className="text-lg font-bold tracking-tight">PACTA</span>
            </button>
            <p className="text-sm text-muted-foreground">{t('footer.tagline')}</p>
          </div>

          {/* Center: Links */}
          <div className="flex flex-col gap-3 md:items-center">
            <h3 className="text-sm font-semibold">{t('footer.links.title', 'Links')}</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <button
                onClick={() => navigate('/download')}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('footer.links.download')}
              </button>
              <button
                onClick={() => navigate('/changelog')}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('footer.links.changelog')}
              </button>
              <a
                href="https://github.com/mowgliph/pacta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-3.5 w-3.5" />
                {t('footer.links.github')}
              </a>
            </div>
          </div>

          {/* Right: Contact + copyright */}
          <div className="flex flex-col gap-3 md:items-end">
            <a
              href="mailto:pactateam@gmail.com"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('contact.emailAddress')}
            </a>
            <p className="text-xs text-muted-foreground/70">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Integrate into HomePage**

Import and add after ContactSection:
```tsx
<LandingFooter />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/LandingFooter.tsx pacta_appweb/src/pages/HomePage.tsx
git commit -m "feat: add landing footer component"
```

---

### Task 7: Download Page

**Files:**
- Create: `pacta_appweb/src/pages/DownloadPage.tsx`
- Modify: `pacta_appweb/src/App.tsx` (add route)

**Step 1: Create DownloadPage.tsx**

```typescript
// pacta_appweb/src/pages/DownloadPage.tsx
"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Linux, Apple, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { fetchLatestRelease, GitHubRelease } from '@/lib/github-api';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

const platformMap: Record<string, { icon: typeof Linux; label: string; match: string[] }> = {
  linux: { icon: Linux, label: 'linux', match: ['linux', 'amd64'] },
  macos: { icon: Apple, label: 'macos', match: ['darwin', 'universal'] },
  windows: { icon: Monitor, label: 'windows', match: ['windows', 'amd64'] },
};

function getAssetForPlatform(release: GitHubRelease, platform: string) {
  const config = platformMap[platform];
  if (!config) return null;
  return release.assets.find((a) =>
    config.match.every((m) => a.name.toLowerCase().includes(m)),
  ) || null;
}

export default function DownloadPage() {
  const { t } = useTranslation('download');
  const navigate = useNavigate();
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestRelease().then((data) => {
      setRelease(data);
      setLoading(false);
    });
  }, []);

  const platforms = ['linux', 'macos', 'windows'];
  const icons: Record<string, typeof Linux> = {
    linux: Linux,
    macos: Apple,
    windows: Monitor,
  };

  return (
    <div className="relative min-h-screen">
      <LandingNavbar />
      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mb-8 gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToHome')}
        </Button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
          {release && !loading && (
            <Badge variant="secondary" className="mt-4">
              {t('latestVersion')}: {release.tag_name}
            </Badge>
          )}
        </motion.div>

        {/* Platform cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-6 md:grid-cols-3"
        >
          {platforms.map((platform, index) => {
            const Icon = icons[platform];
            const asset = release ? getAssetForPlatform(release, platform) : null;
            const config = platformMap[platform];

            return (
              <motion.div
                key={platform}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card className="group h-full overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/20">
                  <CardHeader>
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">
                      {t(`platforms.${platform}.name`)}
                    </CardTitle>
                    <CardDescription>
                      {t(`platforms.${platform}.description`)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {loading ? (
                      <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
                    ) : asset ? (
                      <Button asChild variant="gradient" size="sm">
                        <a href={asset.browser_download_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          {t('downloadNow')}
                        </a>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href="https://github.com/mowgliph/pacta/releases"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('viewAllReleases')}
                        </a>
                      </Button>
                    )}

                    {/* Install instructions */}
                    <Collapsible open={openPlatform === platform} onOpenChange={(open) => setOpenPlatform(open ? platform : null)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full text-xs">
                          {t(`platforms.${platform}.installTitle`)}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                          {t(`platforms.${platform}.installSteps`, { returnObjects: true }).map(
                            (step: string, i: number) => (
                              <li key={i}>{step}</li>
                            ),
                          )}
                        </ol>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Error fallback */}
        {!release && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-muted-foreground">{t('fetchError')}</p>
            <Button variant="link" asChild className="mt-2">
              <a href="https://github.com/mowgliph/pacta/releases" target="_blank" rel="noopener noreferrer">
                {t('viewAllReleases')}
              </a>
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

Add import:
```typescript
import DownloadPage from './pages/DownloadPage';
```

Add route (after the `/` route, before protected routes):
```tsx
<Route path="/download" element={<DownloadPage />} />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/DownloadPage.tsx pacta_appweb/src/App.tsx
git commit -m "feat: add Download page with GitHub releases integration"
```

---

### Task 8: Changelog Page

**Files:**
- Create: `pacta_appweb/src/pages/ChangelogPage.tsx`
- Modify: `pacta_appweb/src/App.tsx` (add route)

**Step 1: Create ChangelogPage.tsx**

```typescript
// pacta_appweb/src/pages/ChangelogPage.tsx
"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, MessageSquare, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  fetchAllReleases,
  GitHubRelease,
  extractTeamCommentary,
  stripTeamCommentary,
} from '@/lib/github-api';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function MarkdownBody({ content }: { content: string }) {
  // Simple markdown rendering: headers, lists, bold, code
  const lines = content.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h3 key={i} className="mt-4 mb-2 text-base font-semibold">
              {line.replace('## ', '')}
            </h3>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h4 key={i} className="mt-3 mb-1 text-sm font-semibold">
              {line.replace('### ', '')}
            </h4>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <li key={i} className="ml-4 list-disc text-muted-foreground">
              {line.replace('- ', '')}
            </li>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-muted-foreground">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="border bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChangelogPage() {
  const { t, i18n } = useTranslation('changelog');
  const navigate = useNavigate();
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllReleases().then((data) => {
      setReleases(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="relative min-h-screen">
      <LandingNavbar />
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mb-8 gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToHome')}
        </Button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border md:left-8" />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
              : releases.length === 0 ? (
                  <p className="text-center text-muted-foreground">{t('fetchError')}</p>
                ) : (
                  releases.map((release, index) => {
                    const commentary = extractTeamCommentary(release.body);
                    const body = stripTeamCommentary(release.body);

                    return (
                      <motion.div
                        key={release.tag_name}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        className="relative pl-16 md:pl-20"
                      >
                        {/* Timeline dot */}
                        <div className="absolute left-[19px] top-8 h-3 w-3 rounded-full border-2 border-primary bg-background md:left-[27px]" />

                        <Card className="border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/30">
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge variant="secondary" className="gap-1">
                                <Tag className="h-3 w-3" />
                                {release.tag_name}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(release.published_at)}
                              </span>
                            </div>
                            <h3 className="text-xl font-semibold">{release.name || release.tag_name}</h3>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Release notes */}
                            {body && <MarkdownBody content={body} />}

                            {/* Team commentary */}
                            {commentary && (
                              <>
                                <Separator />
                                <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <div>
                                    <p className="mb-1 text-xs font-semibold text-primary">
                                      {t('teamNotes')}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{commentary}</p>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Link to GitHub */}
                            <Button variant="ghost" size="sm" asChild className="gap-1">
                              <a href={release.html_url} target="_blank" rel="noopener noreferrer">
                                {t('viewOnGitHub')}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

Add import:
```typescript
import ChangelogPage from './pages/ChangelogPage';
```

Add route:
```tsx
<Route path="/changelog" element={<ChangelogPage />} />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/ChangelogPage.tsx pacta_appweb/src/App.tsx
git commit -m "feat: add Changelog page with GitHub releases timeline"
```

---

### Task 9: SEO & Meta Tags

**Files:**
- Modify: `pacta_appweb/index.html`
- Create: `pacta_appweb/public/favicon.svg`
- Create: `pacta_appweb/public/site.webmanifest`

**Step 1: Update index.html**

Replace the entire `<head>` section:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="PACTA - Local-first Contract Lifecycle Management System. Track, approve, and manage contracts without cloud dependencies. Open source, single binary, zero infrastructure." />
    <meta name="keywords" content="contract management, CLM, legal tech, local-first, open source, contract lifecycle, agreement management" />
    <meta name="author" content="PACTA Team" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://pacta.dev" />

    <!-- Open Graph -->
    <meta property="og:title" content="PACTA - Contract Lifecycle Management" />
    <meta property="og:description" content="Track, approve, and manage contracts without cloud dependencies. Open source, single binary, zero infrastructure." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://pacta.dev" />
    <meta property="og:image" content="/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="PACTA" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="PACTA - Contract Lifecycle Management" />
    <meta name="twitter:description" content="Track, approve, and manage contracts without cloud dependencies. Open source, single binary." />
    <meta name="twitter:image" content="/og-image.png" />

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "PACTA",
      "description": "Local-first Contract Lifecycle Management System for tracking agreements, supplements, and compliance",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Linux, macOS, Windows",
      "url": "https://pacta.dev",
      "downloadUrl": "https://github.com/mowgliph/pacta/releases",
      "license": "https://opensource.org/licenses/MIT",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "author": {
        "@type": "Organization",
        "name": "PACTA Team",
        "email": "pactateam@gmail.com",
        "url": "https://github.com/mowgliph"
      }
    }
    </script>

    <title>PACTA - Contract Lifecycle Management</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 2: Create favicon.svg**

```xml
<!-- pacta_appweb/public/favicon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="6" fill="#7c3aed"/>
  <path d="M8 10h16M8 16h12M8 22h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="24" cy="22" r="3" fill="#f97316"/>
</svg>
```

**Step 3: Create site.webmanifest**

```json
{
  "name": "PACTA - Contract Lifecycle Management",
  "short_name": "PACTA",
  "description": "Local-first Contract Lifecycle Management System",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#7c3aed",
  "icons": [
    {
      "src": "/favicon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/favicon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Step 4: Commit**

```bash
git add pacta_appweb/index.html pacta_appweb/public/favicon.svg pacta_appweb/public/site.webmanifest
git commit -m "feat: add professional SEO meta tags, JSON-LD, and favicon"
```

---

### Task 10: Dynamic Page Titles via Route Effect

**Files:**
- Modify: `pacta_appweb/src/App.tsx` (add title effect to new routes)

**Step 1: Add dynamic title updates**

For the Download and Changelog routes in `App.tsx`, wrap the page components with a title updater. Create a small utility:

```typescript
// pacta_appweb/src/lib/page-title.ts
export function setPageTitle(title: string): void {
  document.title = `${title} - PACTA`;
}
```

In `DownloadPage.tsx` and `ChangelogPage.tsx`, add:

```typescript
import { setPageTitle } from '@/lib/page-title';
import { useEffect } from 'react';

// Inside component:
useEffect(() => {
  setPageTitle(t('title'));
}, [t]);
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/page-title.ts pacta_appweb/src/pages/DownloadPage.tsx pacta_appweb/src/pages/ChangelogPage.tsx
git commit -m "feat: add dynamic page titles for SEO"
```

---

### Task 11: Update LandingNavbar with Features anchor link fix

**Files:**
- Modify: `pacta_appweb/src/components/landing/LandingNavbar.tsx`

**Step 1: Add About and FAQ anchor links to navbar**

Add to the desktop nav section (before LanguageToggle):

```tsx
<a
  href="#about"
  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
>
  {t('nav.about')}
</a>
<a
  href="#faq"
  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
>
  {t('nav.faq')}
</a>
```

Add to mobile menu (before LanguageToggle):

```tsx
<a
  href="#about"
  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
  onClick={() => setMobileOpen(false)}
>
  {t('nav.about')}
</a>
<a
  href="#faq"
  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
  onClick={() => setMobileOpen(false)}
>
  {t('nav.faq')}
</a>
```

Update `landing.json` nav section to add:
```json
"nav": {
  "features": "Features",
  "about": "About",
  "faq": "FAQ",
  "login": "Login"
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/components/landing/LandingNavbar.tsx pacta_appweb/public/locales/
git commit -m "feat: add About and FAQ anchor links to landing navbar"
```

---

### Task 12: Build Verification & Final Commit

**Step 1: Run TypeScript type check**

```bash
cd pacta_appweb && npx tsc --noEmit
```
Expected: No errors

**Step 2: Run existing tests**

```bash
cd pacta_appweb && npx vitest run
```
Expected: All tests pass (including new github-api tests)

**Step 3: Run build**

```bash
cd pacta_appweb && npm run build
```
Expected: Successful build with no errors

**Step 4: Final commit (if any build output changes)**

```bash
git status
git add -A
git commit -m "chore: landing page enhancement complete"
```

---

## Summary of Files Created/Modified

**Created (14 files):**
1. `pacta_appweb/public/locales/en/download.json`
2. `pacta_appweb/public/locales/es/download.json`
3. `pacta_appweb/public/locales/en/changelog.json`
4. `pacta_appweb/public/locales/es/changelog.json`
5. `pacta_appweb/src/lib/github-api.ts`
6. `pacta_appweb/src/__tests__/github-api.test.ts`
7. `pacta_appweb/src/lib/page-title.ts`
8. `pacta_appweb/src/components/landing/AboutSection.tsx`
9. `pacta_appweb/src/components/landing/FaqSection.tsx`
10. `pacta_appweb/src/components/landing/ContactSection.tsx`
11. `pacta_appweb/src/components/landing/LandingFooter.tsx`
12. `pacta_appweb/src/pages/DownloadPage.tsx`
13. `pacta_appweb/src/pages/ChangelogPage.tsx`
14. `pacta_appweb/public/favicon.svg`
15. `pacta_appweb/public/site.webmanifest`

**Modified (8 files):**
1. `pacta_appweb/public/locales/en/landing.json`
2. `pacta_appweb/public/locales/es/landing.json`
3. `pacta_appweb/public/locales/en/common.json`
4. `pacta_appweb/public/locales/es/common.json`
5. `pacta_appweb/src/pages/HomePage.tsx`
6. `pacta_appweb/src/App.tsx`
7. `pacta_appweb/index.html`
8. `pacta_appweb/src/components/landing/LandingNavbar.tsx`
