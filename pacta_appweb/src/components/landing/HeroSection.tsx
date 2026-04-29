"use client";

import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedLogo } from '@/components/AnimatedLogo';

const MotionButton = motion.create(Button);

const fadeUpVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  },
};

const shapeVariants = {
  hidden: { opacity: 0, y: -100 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 2, ease: [0.23, 0.86, 0.39, 0.96] as [number, number, number, number] },
  },
};

const floatAnimation = {
  y: [0, 15, 0, -10, 0],
  rotate: [0, 3, 0, -3, 0],
  transition: {
    duration: 12,
    repeat: Infinity,
    ease: 'easeInOut' as const,
    times: [0, 0.25, 0.5, 0.75, 1]
  },
};

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  parallaxY,
}: {
  className: string;
  delay?: number;
  width?: number;
  height?: number;
  parallaxY?: MotionValue<number>;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      variants={shapeVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={`absolute ${className}`}
      style={parallaxY ? { y: parallaxY } : undefined}
    >
      <motion.div
        animate={prefersReducedMotion ? { y: 0, rotate: 0 } : floatAnimation}
        style={{ width, height }}
        className="relative rounded-full bg-gradient-to-r from-primary/10 to-transparent blur-[1px] border border-primary/10"
      />
    </motion.div>
  );
}

export function HeroSection() {
  const navigate = useNavigate();
  const { t } = useTranslation('landing');

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const bgY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const shape1Y = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const shape2Y = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const shape3Y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const shape4Y = useTransform(scrollYProgress, [0, 1], [0, -120]);

  return (
    <section ref={heroRef} className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24">
      {/* Background gradient */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-primary/5"
      />

      {/* Animated geometric shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <ElegantShape delay={0.3} width={500} height={120} className="left-[-10%] top-[15%]" parallaxY={shape1Y} />
        <ElegantShape delay={0.5} width={400} height={100} className="right-[-5%] top-[70%]" parallaxY={shape2Y} />
        <ElegantShape delay={0.4} width={250} height={70} className="left-[5%] bottom-[5%]" parallaxY={shape3Y} />
        <ElegantShape delay={0.6} width={180} height={50} className="right-[15%] top-[10%]" parallaxY={shape4Y} />
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
          <span className="text-muted-foreground">{t('hero.subtitle')}</span>
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
            {t('hero.title').split(' ').map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{
                  delay: 0.4 + (i * 0.1),
                  duration: 0.6,
                  ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number]
                }}
                className="inline-block mr-2"
              >
                {word}
              </motion.span>
            ))}
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
          {t('hero.description')}
          {t('hero.benefit')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.8 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <MotionButton
            size="lg"
            variant="gradient"
            onClick={() => navigate('/login')}
            className="group rounded-xl px-8 text-base"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 30px rgba(37, 99, 235, 0.4)",
              transition: { duration: 0.3 }
            }}
            whileTap={{ scale: 0.95 }}
          >
            {t('hero.startNow')}
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.div>
          </MotionButton>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              const el = document.getElementById('features');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="rounded-xl px-8 text-base"
          >
            {t('hero.learnMore')}
          </Button>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
