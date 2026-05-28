import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

type Stage = 'enter' | 'loading' | 'success' | 'error' | 'needs-login';

export const OAuthDevicePage: React.FC = () => {
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('enter');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-fill code from ?code= query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) setCode(c.toUpperCase());
  }, []);

  // Auto-submit if code came pre-filled from verification_uri_complete
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (code && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit(code);
    }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (codeToSubmit: string) => {
    const normalized = codeToSubmit.replace(/\s+-/g, '').trim();
    if (!normalized) return;
    setStage('loading');
    try {
      await axios.get(`/api/oauth/device/verify?code=${encodeURIComponent(normalized)}`);
      setStage('success');
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || 'Something went wrong';
      if (status === 401) {
        setStage('needs-login');
      } else {
        setErrorMsg(msg);
        setStage('error');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(code);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      background: colors.background,
    }}>
      <div style={{
        width: 420,
        maxWidth: '100%',
        background: colors.surface,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: borderRadius.lg,
        padding: spacing['3xl'],
        boxShadow: shadows.lg,
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: borderRadius.lg,
          background: 'rgba(16,185,129,0.1)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: spacing.lg,
          fontSize: 22, fontWeight: 700, color: colors.primary,
        }}>
          FS
        </div>

        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
          Authorize Fuji Studio Desktop
        </h1>

        {stage === 'enter' && (
          <>
            <p style={{ margin: '8px 0 24px', color: colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
              Enter the code shown in the desktop app to link it to your account.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: colors.inputBackground,
                  border: `1px solid ${colors.glassBorder}`,
                  borderRadius: borderRadius.md,
                  color: colors.textPrimary,
                  fontSize: 24, fontWeight: 700, letterSpacing: '0.15em',
                  textAlign: 'center',
                  padding: '12px 16px',
                  marginBottom: spacing.lg,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!code.trim()}
                style={{
                  width: '100%',
                  background: code.trim() ? colors.primary : colors.glassBorder,
                  color: '#fff',
                  border: 'none',
                  borderRadius: borderRadius.md,
                  padding: '12px 16px',
                  fontSize: 14, fontWeight: 600,
                  cursor: code.trim() ? 'pointer' : 'default',
                }}
              >
                Authorize Device
              </button>
            </form>
          </>
        )}

        {stage === 'loading' && (
          <div style={{ marginTop: spacing.xl, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14 }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Authorizing…
          </div>
        )}

        {stage === 'success' && (
          <div style={{ marginTop: spacing.xl }}>
            <CheckCircle size={48} color={colors.primary} style={{ marginBottom: spacing.lg }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>Device authorized!</h2>
            <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
              You can close this tab and return to the desktop app.
            </p>
          </div>
        )}

        {stage === 'needs-login' && (
          <div style={{ marginTop: spacing.xl }}>
            <AlertCircle size={40} color={colors.warning || '#f59e0b'} style={{ marginBottom: spacing.lg }} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textPrimary }}>Sign in first</h2>
            <p style={{ margin: '8px 0 24px', color: colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
              You need to be signed in to authorize the desktop app.
            </p>
            <a
              href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
              style={{
                display: 'inline-block',
                background: colors.primary, color: '#fff',
                borderRadius: borderRadius.md,
                padding: '10px 24px',
                fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Sign in to Fuji Studio
            </a>
          </div>
        )}

        {stage === 'error' && (
          <div style={{ marginTop: spacing.xl }}>
            <AlertCircle size={40} color={colors.error} style={{ marginBottom: spacing.lg }} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textPrimary }}>Authorization failed</h2>
            <p style={{ margin: '8px 0 24px', color: colors.textSecondary, fontSize: 13 }}>{errorMsg}</p>
            <button
              onClick={() => { setStage('enter'); autoSubmitted.current = false; }}
              style={{
                background: 'transparent', border: `1px solid ${colors.glassBorder}`,
                color: colors.textSecondary, borderRadius: borderRadius.md,
                padding: '8px 20px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
