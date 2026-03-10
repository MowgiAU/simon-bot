import React from 'react';

/**
 * Fuji Studio Logo Component
 * Derived from favicon.svg
 */
export const FujiLogo: React.FC<{ size?: number; color?: string; opacity?: number }> = ({ 
    size = 24, 
    color = '#2b8c71',
    opacity = 1
}) => {
    return (
        <svg 
            width={size} 
            height={size} 
            viewBox="0 0 512 512" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ opacity }}
        >
            <circle cx="256" cy="256" r="160" stroke={color} strokeWidth="32" fill="none" />
            <path d="M256 160V352 M160 256H352" stroke={color} strokeWidth="32" strokeLinecap="round" />
        </svg>
    );
};
