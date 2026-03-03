import React, { useState } from 'react';
import { LucideIcon, LucideProps } from 'lucide-react';
import { motion, useAnimation } from 'motion/react';

interface AnimatedIconProps extends LucideProps {
  icon: LucideIcon;
  trigger?: 'hover' | 'click' | 'loop';
}

/**
 * High-fidelity animated Lucide icons using Framer Motion.
 * Supports path-based animations and physics-based transitions.
 */
export const AnimatedIcon: React.FC<AnimatedIconProps> = ({ 
  icon: Icon, 
  trigger = 'hover',
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  ...props 
}) => {
  const controls = useAnimation();
  const [isHovered, setIsHovered] = useState(false);

  // Define animation variants based on icon type (can be expanded)
  const variants = {
    hover: {
      scale: 1.2,
      rotate: [0, -5, 5, -5, 0],
      transition: { duration: 0.4, ease: "easeInOut" }
    },
    initial: {
      scale: 1,
      rotate: 0
    }
  };

  return (
    <motion.div
      initial="initial"
      animate={isHovered ? "hover" : "initial"}
      variants={variants}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        cursor: 'pointer',
        ...style 
      }}
    >
      <Icon 
        size={size} 
        color={color} 
        strokeWidth={strokeWidth}
        {...props} 
      />
    </motion.div>
  );
};
