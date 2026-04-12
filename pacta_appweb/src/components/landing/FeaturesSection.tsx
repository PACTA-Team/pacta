"use client";

import { motion } from 'framer-motion';
import { FileText, Bell, BarChart3, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: FileText,
    title: 'Contract Management',
    description: 'Create, review, and approve contracts with full version tracking and audit trails.',
  },
  {
    icon: Bell,
    title: 'Expiration Alerts',
    description: 'Never miss a renewal with automated notifications and smart deadline tracking.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Real-time dashboards with contract lifecycle insights and compliance tracking.',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

export function FeaturesSection() {
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
            <span className="text-muted-foreground">Features</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              stay in control
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            PACTA gives you the tools to manage contracts from creation to expiration.
          </p>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid gap-6 md:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={cardVariants}>
              <Card className="group relative h-full overflow-hidden border bg-card/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg">
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary/5 transition-all duration-300 group-hover:bg-primary/10" />
                <CardHeader>
                  <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span>Learn more</span>
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
