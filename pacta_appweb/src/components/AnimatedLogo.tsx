"use client";

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

function LogoSvg() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <path
        d="m48,39c0,4.971-4.029,9-9,9h-30c-4.971,0-9-4.029-9-9v-27-3c0-4.971 4.029-9 9-9h3 27c4.971,0 9,4.029 9,9v30zm-33-30c0-1.656-1.344-3-3-3h-3c-1.656,0-3,1.344-3,3v3c0,1.656 1.344,3 3,3h3c1.656,0 3-1.344 3-3v-3zm27,28.665l-5.619-5.619 2.103-2.049c.858-.858 1.116-2.586 .651-3.705-.465-1.122-1.56-2.292-2.772-2.292h-8.484c-.828,0-2.019,.774-2.562,1.317-.54,.54-1.317,1.731-1.317,2.559v8.484c0,1.215 1.173,2.307 2.292,2.772s2.631,.207 3.489-.651l2.307-2.247 5.763,5.766h-28.851c-1.656,0-3-1.341-3-3v-18h6c4.968,0 9-4.029 9-9v-6h18c1.659,0 3,1.344 3,3v28.665z"
        className="fill-current"
      />
    </svg>
  );
}

export function AnimatedLogo({ size = 'md', className = '', animate = true }: AnimatedLogoProps) {
  if (!animate) {
    return (
      <div className={cn(sizeMap[size], className)}>
        <LogoSvg />
      </div>
    );
  }

  return (
    <motion.div
      className={cn(sizeMap[size], className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <LogoSvg />
      </motion.div>
    </motion.div>
  );
}
