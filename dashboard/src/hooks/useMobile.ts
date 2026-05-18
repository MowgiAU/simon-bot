import { useState, useEffect } from 'react';

export const useMobile = (breakpoint = 768) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            // Debounce: only commit the new value after the user stops resizing
            // for 150ms. This prevents a flood of React re-renders mid-drag that
            // can race with browser-extension DOM mutations and trigger removeChild errors.
            clearTimeout(timer);
            timer = setTimeout(() => setIsMobile(window.innerWidth < breakpoint), 150);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, [breakpoint]);

    return isMobile;
};