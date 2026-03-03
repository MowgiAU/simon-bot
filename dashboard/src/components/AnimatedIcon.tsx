import React from 'react';
import { LucideIcon, LucideProps, Icon } from 'lucide-react';
import * as labIcons from '@lucide/lab';

interface AnimatedIconProps extends LucideProps {
  icon: LucideIcon;
  animationName?: string;
  trigger?: 'hover' | 'click' | 'loop';
}

/**
 * Uses @lucide/lab's Icon component to render animated/extra icons accurately.
 */
export const AnimatedIcon: React.FC<AnimatedIconProps> = ({ 
  icon: OriginalIcon, 
  animationName,
  trigger = 'hover',
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  ...props 
}) => {
  // Map the lucide-react name to the @lucide/lab icon node if possible
  const iconName = animationName || (OriginalIcon as any).displayName?.toLowerCase().replace(/icon$/, '') || '';
  const labIconNode = (labIcons as any)[iconName];

  if (labIconNode) {
    return (
      <Icon 
        iconNode={labIconNode} 
        size={size} 
        color={color} 
        strokeWidth={strokeWidth}
        style={{
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'pointer',
          ...style
        }}
        className="lucide-animated"
        {...props}
      />
    );
  }

  // Fallback to the original icon with standard hover effect
  return (
    <OriginalIcon 
      size={size} 
      color={color} 
      strokeWidth={strokeWidth}
      style={{
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer',
        ...style
      }}
      className="lucide-animated"
      {...props}
    />
  );
};
