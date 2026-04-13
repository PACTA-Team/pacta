"use client";

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import LoginForm from '@/components/auth/LoginForm';
import { AnimatedLogo } from '@/components/AnimatedLogo';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex">
      {/* Left branding panel - hidden on mobile */}
      <motion.div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5 p-8"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.div
          className="cursor-pointer"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => navigate('/')}
        >
          <AnimatedLogo size="xl" />
        </motion.div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">PACTA</h1>
        <p className="mt-2 text-lg text-muted-foreground text-center max-w-sm">
          Manage contracts with clarity
        </p>
      </motion.div>

      {/* Right form panel */}
      <motion.div
        className="flex w-full md:w-1/2 lg:w-2/5 items-center justify-center bg-background p-6"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo - visible only on mobile */}
          <motion.div
            className="mb-8 flex justify-center md:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <motion.div
              className="cursor-pointer"
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/')}
            >
              <AnimatedLogo size="md" animate={false} />
            </motion.div>
          </motion.div>
          <LoginForm />
        </div>
      </motion.div>
    </div>
  );
}
