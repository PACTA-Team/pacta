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
import { setPageTitle } from '@/lib/page-title';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function MarkdownBody({ content }: { content: string }) {
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
  const { t } = useTranslation('changelog');
  const navigate = useNavigate();
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllReleases().then((data) => {
      setReleases(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setPageTitle(t('title'));
  }, [t]);

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
