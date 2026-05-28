import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Download, Monitor, RefreshCw, CheckCircle, Layers } from 'lucide-react';

interface UpdateManifest {
  version: string;
  notes: string;
  pub_date: string;
  platforms: {
    'windows-x86_64'?: { url: string };
  };
}

export const DownloadPage: React.FC = () => {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get<UpdateManifest>('/api/desktop/update')
      .then(r => setManifest(r.data))
      .catch(() => setManifest(null))
      .finally(() => setLoading(false));
  }, []);

  const downloadUrl = manifest?.platforms?.['windows-x86_64']?.url;

  return (
    <DiscoveryLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing['3xl']} ${spacing.xl}` }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: spacing['3xl'] }}>
          <div style={{
            width: 72, height: 72, borderRadius: borderRadius.lg,
            background: 'rgba(16,185,129,0.1)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing.xl,
          }}>
            <Layers size={36} color={colors.primary} />
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
            Fuji Studio Desktop
          </h1>
          <p style={{ margin: '12px 0 0', color: colors.textSecondary, fontSize: 16, lineHeight: 1.6 }}>
            Automatically sync your FL Studio projects to your account.<br />
            Version history, file deduplication, and background watching — all handled for you.
          </p>
        </div>

        {/* Download card */}
        <div style={{
          background: colors.surface,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: borderRadius.lg,
          padding: spacing.xxl,
          marginBottom: spacing.xl,
          textAlign: 'center',
        }}>
          {loading ? (
            <div style={{ color: colors.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Checking for latest version…
            </div>
          ) : manifest ? (
            <>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
                Latest release: <strong style={{ color: colors.textPrimary }}>v{manifest.version}</strong>
                {manifest.notes && <span> — {manifest.notes}</span>}
              </div>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    background: colors.primary, color: '#fff',
                    padding: '14px 32px', borderRadius: borderRadius.md,
                    textDecoration: 'none', fontWeight: 700, fontSize: 15,
                  }}
                >
                  <Download size={18} /> Download for Windows
                </a>
              ) : (
                <div style={{ color: colors.textTertiary, fontSize: 13 }}>No Windows installer available yet.</div>
              )}
              <div style={{ marginTop: spacing.md, fontSize: 12, color: colors.textTertiary }}>
                Windows 10/11 · 64-bit · ~10 MB
              </div>
            </>
          ) : (
            <div style={{ color: colors.textTertiary, fontSize: 13 }}>
              No release available yet — check back soon.
            </div>
          )}
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg, marginBottom: spacing['3xl'] }}>
          {[
            { icon: <RefreshCw size={18} />, title: 'Auto-sync', body: 'Watches your project folder and syncs changes automatically whenever you save.' },
            { icon: <Layers size={18} />, title: 'Version history', body: 'Every sync creates a version snapshot. Browse diffs, see exactly what changed.' },
            { icon: <Monitor size={18} />, title: 'Runs in the tray', body: 'Lives in your system tray. Always watching, never in your way.' },
            { icon: <CheckCircle size={18} />, title: 'Deduplication', body: 'Only uploads files that changed. Large sample libraries sync fast after the first time.' },
          ].map(f => (
            <div key={f.title} style={{ background: colors.surface, border: `1px solid ${colors.glassBorder}`, borderRadius: borderRadius.md, padding: spacing.lg }}>
              <div style={{ color: colors.primary, marginBottom: spacing.sm }}>{f.icon}</div>
              <div style={{ fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>{f.body}</div>
            </div>
          ))}
        </div>

        {/* Install note */}
        <div style={{ background: `rgba(16,185,129,0.05)`, border: `1px solid rgba(16,185,129,0.15)`, borderRadius: borderRadius.md, padding: spacing.lg, fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
          <strong style={{ color: colors.textPrimary }}>First-time install:</strong> Windows may show a SmartScreen warning. Click <em>More info → Run anyway</em> to proceed. The app is safe — we're working on code signing.
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </DiscoveryLayout>
  );
};
