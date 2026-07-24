import { motion, AnimatePresence } from 'framer-motion';

// Shared animation variants
export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideInRight = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 100, opacity: 0 },
};

export const expandHeight = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

export const collapseHeight = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

export const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const messageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95 },
};

export const thinkingPulse = {
  animate: {
    opacity: [0.4, 1, 0.4],
    scale: [0.85, 1, 0.85],
  },
  transition: {
    duration: 1.2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

export const dotPulse = (delay: number) => ({
  animate: {
    opacity: [0.4, 1, 0.4],
    scale: [0.85, 1, 0.85],
  },
  transition: {
    duration: 1.2,
    repeat: Infinity,
    ease: 'easeInOut',
    delay,
  },
});

export { motion, AnimatePresence };
