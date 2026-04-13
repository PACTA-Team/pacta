"use client";

import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Home, LogIn } from 'lucide-react';

function FloatingParticle({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-red-500/10 dark:bg-red-500/20"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
      animate={{
        y: [0, -20, 0],
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        delay,
        ease: 'easeInOut' as const,
      }}
    />
  );
}

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
  };

  const iconVariants: Variants = {
    hidden: { opacity: 0, scale: 0, rotate: -180 },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: { type: 'spring' as const, stiffness: 150, damping: 12, delay: 0.4 },
    },
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <FloatingParticle delay={0} x={10} y={20} size={8} />
        <FloatingParticle delay={0.5} x={80} y={15} size={12} />
        <FloatingParticle delay={1} x={70} y={70} size={6} />
        <FloatingParticle delay={1.5} x={20} y={80} size={10} />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-2xl text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-red-500/10 to-red-500/20 dark:from-red-500/20 dark:to-red-500/30"
          variants={iconVariants}
        >
          <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400" aria-hidden="true" />
        </motion.div>

        <motion.h1
          className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-9xl font-bold tracking-tighter text-transparent dark:from-red-400 dark:via-red-500 dark:to-red-400 sm:text-[12rem]"
          variants={itemVariants}
        >
          403
        </motion.h1>

        <motion.h2
          className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl"
          variants={itemVariants}
        >
          {t('accessDenied')}
        </motion.h2>

        <motion.p
          className="mx-auto mt-4 max-w-md text-lg text-muted-foreground"
          variants={itemVariants}
        >
          {t('setupCompleted')}
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
          variants={itemVariants}
        >
          <Button onClick={() => navigate('/')} size="lg" className="min-w-[180px] gap-2">
            <Home className="h-5 w-5" />
            {t('goToHome')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/login')} size="lg" className="min-w-[180px] gap-2">
            <LogIn className="h-5 w-5" />
            {t('login')}
          </Button>
        </motion.div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-red-500/20 to-transparent blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' as const }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-tr from-red-500/20 to-transparent blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' as const }}
        aria-hidden="true"
      />
    </div>
  );
}
