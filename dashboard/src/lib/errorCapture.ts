/** Circular buffer of recent unhandled JS errors — populated once and read by the bug report modal */

interface CapturedError {
    message: string;
    stack?: string;
    timestamp: string;
}

const MAX = 10;
const buffer: CapturedError[] = [];

function push(err: CapturedError) {
    buffer.push(err);
    if (buffer.length > MAX) buffer.shift();
}

if (typeof window !== 'undefined') {
    window.addEventListener('error', e => {
        push({ message: e.message || String(e), stack: e.error?.stack, timestamp: new Date().toISOString() });
    });
    window.addEventListener('unhandledrejection', e => {
        const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
        push({ message: msg, stack: (e.reason as any)?.stack, timestamp: new Date().toISOString() });
    });
}

export const getRecentErrors = (): CapturedError[] => buffer.slice();
