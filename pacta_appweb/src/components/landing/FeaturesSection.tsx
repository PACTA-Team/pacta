"use client";

import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { FileText, Bell, BarChart3, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

  export function FeaturesSection() {
  const { t } = useTranslation('landing');
  const prefersReducedMotion = useReducedMotion();

  const features = [
    {
      icon: FileText,
      title: t('features.items.0.title'),
      description: t('features.items.0.description'),
    },
    {
      icon: Bell,
      title: t('features.items.1.title'),
      description: t('features.items.1.description'),
    },
    {
      icon: BarChart3,
      title: t('features.items.2.title'),
      description: t('features.items.2.description'),
    },
  ];

  return (
    <section id="features" className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
            <span className="text-muted-foreground">{t('features.title')}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {t('features.subtitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t('features.description')}
          </p>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          variants={containerVariants}
          initial={prefersReducedMotion ? "visible" : "hidden"}
          whileInView={prefersReducedMotion ? undefined : "visible"}
          viewport={{ once: true, margin: '-100px' }}
          className="grid gap-6 md:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              whileHover={{
                y: -8,
                scale: 1.02,
                rotate: 0.5,
                boxShadow: "0 20px 40px rgba(37, 99, 235, 0.15)",
                transition: { duration: 0.3, ease: 'easeOut' }
              }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="group relative h-full overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/20">
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-br from-primary/5 to-accent/5 transition-all duration-300 group-hover:from-primary/10 group-hover:to-accent/10" />
                <CardHeader>
                  <motion.div 
                    className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20"
                    whileHover={{ 
                      rotate: 5,
                      scale: 1.1,
                      transition: { duration: 0.3 }
                    }}
                  >
                    <feature.icon className="h-6 w-6 text-primary" />
                  </motion.div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span>{t('features.learnMore')}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
