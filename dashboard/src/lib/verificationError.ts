import { showToast } from '../components/Toast';

/**
 * Returns true if the error is a 403 email_verification_required response.
 * Also shows a toast directing the user to verify their email.
 */
export function handleVerificationError(e: any): boolean {
    if (e?.response?.status === 403 && e?.response?.data?.error === 'email_verification_required') {
        showToast('Please verify your email address before performing this action. Check your inbox for a verification link.', 'error');
        return true;
    }
    return false;
}

/**
 * Pre-check: call before any action that requires verification.
 * Returns true if the user is NOT verified (and shows a toast).
 */
export function assertVerified(emailVerified: boolean): boolean {
    if (!emailVerified) {
        showToast('Please verify your email address before performing this action. Check your inbox for a verification link.', 'error');
        return true;
    }
    return false;
}
