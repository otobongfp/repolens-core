'use client';

import { motion } from 'motion/react';

export interface RevealProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
  width?: 'fit-content' | '100%';
  delay?: number;
  slideDirection?: 'top' | 'bottom' | 'left' | 'right';
}

export const Reveal = ({
  children,
  width = 'fit-content',
  delay = 0.25,
  slideDirection = 'bottom',
}: RevealProps) => {
  const variants = (() => {
    switch (slideDirection) {
      case 'top':
        return {
          hidden: { opacity: 0, y: -75, x: 0 },
          visible: { opacity: 1, y: 0, x: 0 },
        };
      case 'left':
        return {
          hidden: { opacity: 0, y: 0, x: -75 },
          visible: { opacity: 1, y: 0, x: 0 },
        };
      case 'right':
        return {
          hidden: { opacity: 0, y: 0, x: 75 },
          visible: { opacity: 1, y: 0, x: 0 },
        };
      default:
        return {
          hidden: { opacity: 0, y: 75, x: 0 },
          visible: { opacity: 1, y: 0, x: 0 },
        };
    }
  })();

  return (
    <div
      style={{
        position: 'relative',
        width,
        overflow: 'hidden',
      }}
    >
      <motion.div
        variants={variants}
        initial='hidden'
        animate='visible'
        transition={{ duration: 0.5, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
};
