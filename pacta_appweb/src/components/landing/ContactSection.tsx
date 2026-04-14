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
