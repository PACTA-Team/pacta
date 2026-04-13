"use client";

import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, FileQuestion } from 'lucide-react';
import { AnimatedLogo } from '@/components/AnimatedLogo';

// Floating particle component
function FloatingParticle({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-primary/10 dark:bg-primary/20"
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

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const },
    },
  };

  const numberVariants: Variants = {
    hidden: { opacity: 0, scale: 0.5, rotate: -10 },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 200,
        damping: 15,
        duration: 0.8,
      },
    },
  };

  const iconVariants: Variants = {
    hidden: { opacity: 0, scale: 0, rotate: -180 },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 150,
        damping: 12,
        delay: 0.4,
      },
    },
    hover: {
      scale: 1.1,
      rotate: [0, -5, 5, 0],
      transition: { duration: 0.5 },
    },
  };

  const buttonHoverVariants: Variants = {
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 },
    },
    tap: {
      scale: 0.95,
      transition: { duration: 0.1 },
    },
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted p-4">
      {/* Animated background particles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <FloatingParticle delay={0} x={10} y={20} size={8} />
        <FloatingParticle delay={0.5} x={80} y={15} size={12} />
        <FloatingParticle delay={1} x={70} y={70} size={6} />
        <FloatingParticle delay={1.5} x={20} y={80} size={10} />
        <FloatingParticle delay={2} x={50} y={40} size={8} />
        <FloatingParticle delay={0.8} x={90} y={50} size={14} />
        <FloatingParticle delay={1.2} x={30} y={60} size={6} />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-2xl text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Animated icon */}
        <motion.div
          className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30"
          variants={iconVariants}
          whileHover="hover"
        >
          <FileQuestion className="h-12 w-12 text-primary" aria-hidden="true" />
        </motion.div>

        {/* 404 Number */}
        <motion.h1
          className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-9xl font-bold tracking-tighter text-transparent sm:text-[12rem]"
          variants={numberVariants}
        >
          404
        </motion.h1>

        {/* Message */}
        <motion.h2
          className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl"
          variants={itemVariants}
        >
          Page Not Found
        </motion.h2>

        <motion.p
          className="mx-auto mt-4 max-w-md text-lg text-muted-foreground"
          variants={itemVariants}
        >
          {t('notFoundDesc')}
        </motion.p>

        {/* Action buttons */}
        <motion.div
          className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
          variants={itemVariants}
        >
          <motion.div variants={buttonHoverVariants} whileHover="hover" whileTap="tap">
            <Button
              size="lg"
              onClick={() => navigate('/')}
              className="min-w-[200px] gap-2"
            >
              <Home className="h-5 w-5" aria-hidden="true" />
              {t('goHome')}
            </Button>
          </motion.div>

          <motion.div variants={buttonHoverVariants} whileHover="hover" whileTap="tap">
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(-1)}
              className="min-w-[200px] gap-2"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              {t('goBack')}
            </Button>
          </motion.div>
        </motion.div>

        {/* Additional help text */}
        <motion.p
          className="mt-12 text-sm text-muted-foreground"
          variants={itemVariants}
        >
          {t('needHelp')}{' '}
          <button
            onClick={() => navigate('/login')}
            className="cursor-pointer text-primary underline-offset-4 transition-colors hover:underline"
          >
            {t('contactSupport')}
          </button>
        </motion.p>
      </motion.div>

      {/* Decorative gradient orbs */}
      <motion.div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-tr from-primary/20 to-transparent blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
