"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Terminal, Apple, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { fetchLatestRelease, GitHubRelease } from '@/lib/github-api';
import { setPageTitle } from '@/lib/page-title';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

const platformMap: Record<string, { match: string[] }> = {
  linux: { match: ['linux', 'amd64'] },
  macos: { match: ['darwin', 'universal'] },
  windows: { match: ['windows', 'amd64'] },
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

  useEffect(() => {
    setPageTitle(t('title'));
  }, [t]);

  const platforms = ['linux', 'macos', 'windows'];
  const icons: Record<string, typeof Terminal> = {
    linux: Terminal,
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
                          href="https://github.com/PACTA-Team/pacta/releases"
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
                          {(t(`platforms.${platform}.installSteps`, { returnObjects: true }) as string[]).map(
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
              <a href="https://github.com/PACTA-Team/pacta/releases" target="_blank" rel="noopener noreferrer">
                {t('viewAllReleases')}
              </a>
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
