import React, { useState } from 'react';
import { LucideIcon, LucideProps } from 'lucide-react';
import { motion } from 'framer-motion';

interface AnimatedWrapperProps extends LucideProps {
  icon: LucideIcon;
  trigger?: 'hover' | 'click';
}

/**
 * Custom interactive wrapper for icons.
 * Provides a smooth scale and subtle wiggle animation on interaction.
 */
export const AnimatedWrapper: React.FC<AnimatedWrapperProps> = ({ 
  icon: Icon, 
  trigger = 'hover',
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  ...props 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const variants = {
    hover: {
      scale: 1.15,
      rotate: [0, -3, 3, -3, 0],
      transition: { duration: 0.3, ease: "easeInOut" }
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
