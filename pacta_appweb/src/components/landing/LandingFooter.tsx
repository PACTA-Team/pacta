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
            <h3 className="text-sm font-semibold">Links</h3>
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
