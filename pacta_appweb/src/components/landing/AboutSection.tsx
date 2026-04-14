"use client";

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Shield, Globe, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
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
