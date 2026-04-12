"use client";

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedLogo } from '@/components/AnimatedLogo';

const fadeUpVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const shapeVariants = {
  hidden: { opacity: 0, y: -100 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 2, ease: [0.23, 0.86, 0.39, 0.96] },
  },
};

const floatAnimation = {
  y: [0, 12, 0],
  transition: { duration: 10, repeat: Infinity, ease: 'easeInOut' },
};

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
}: {
  className: string;
  delay?: number;
  width?: number;
  height?: number;
}) {
  return (
    <motion.div
      variants={shapeVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={`absolute ${className}`}
    >
      <motion.div
        animate={floatAnimation}
        style={{ width, height }}
        className="relative rounded-full bg-gradient-to-r from-primary/10 to-transparent blur-[1px] border border-primary/10"
      />
    </motion.div>
  );
}

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

      {/* Animated geometric shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <ElegantShape delay={0.3} width={500} height={120} className="left-[-10%] top-[15%]" />
        <ElegantShape delay={0.5} width={400} height={100} className="right-[-5%] top-[70%]" />
        <ElegantShape delay={0.4} width={250} height={70} className="left-[5%] bottom-[5%]" />
        <ElegantShape delay={0.6} width={180} height={50} className="right-[15%] top-[10%]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Logo */}
        <motion.div
          className="mx-auto mb-8 flex justify-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 200 }}
        >
          <AnimatedLogo size="xl" />
        </motion.div>

        {/* Badge */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">Contract Management System</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.4 }}
          className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl md:leading-tight"
        >
          <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
            Manage Contracts
          </span>
          <br />
          <span className="bg-gradient-to-r from-primary via-foreground/90 to-primary/70 bg-clip-text text-transparent">
            with Clarity
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.6 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
        >
          Track, approve, and monitor every contract in one place.
          Never miss a renewal again.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.8 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            size="lg"
            onClick={() => navigate('/login')}
            className="group rounded-xl px-8 text-base"
          >
            Start Now
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              const el = document.getElementById('features');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="rounded-xl px-8 text-base"
          >
            Learn More
          </Button>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
