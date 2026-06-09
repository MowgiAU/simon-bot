import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Download, Monitor, RefreshCw, CheckCircle, Layers, Smartphone, AlertTriangle, Settings } from 'lucide-react';

interface UpdateManifest {
  version: string;
  notes: string;
  pub_date: string;
  platforms: {
    'windows-x86_64'?: { url: string };
  };
}

const ANDROID_APK_URL = 'https://cdn.fujistud.io/downloads/fuji-studio.apk';

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

  const sideloadSteps = [
    { icon: <Settings size={16} />, text: 'Open Settings → Apps → Special app access → Install unknown apps' },
    { icon: <Smartphone size={16} />, text: 'Select your browser and enable "Allow from this source"' },
    { icon: <Download size={16} />, text: 'Tap the download button above and open the APK when prompted' },
    { icon: <CheckCircle size={16} />, text: 'Tap Install — you\'re done' },
  ];

  return (
    <DiscoveryLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing['3xl']} ${spacing.xl}` }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: spacing['3xl'] }}>
          <div style={{
            width: 72, height: 72, borderRadius: borderRadius.lg,
            background: 'rgba(242, 120, 10,0.1)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing.xl,
          }}>
            <Layers size={36} color={colors.primary} />
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
            Fuji Studio
          </h1>
          <p style={{ margin: '12px 0 0', color: colors.textSecondary, fontSize: 16, lineHeight: 1.6 }}>
            Download the app for your platform.
          </p>
        </div>

        {/* ── Android ── */}
        <div style={{ marginBottom: spacing['3xl'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Smartphone size={20} color={colors.primary} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>Android</h2>
          </div>

          <div style={{
            background: colors.surface,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: borderRadius.lg,
            padding: spacing.xxl,
            textAlign: 'center',
            marginBottom: spacing.lg,
          }}>
            <p style={{ margin: `0 0 ${spacing.lg}`, color: colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
              Direct APK download — Play Store coming soon.
            </p>
            <a
              href={ANDROID_APK_URL}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: colors.primary, color: '#fff',
                padding: '14px 32px', borderRadius: borderRadius.md,
                textDecoration: 'none', fontWeight: 700, fontSize: 15,
              }}
            >
              <Download size={18} /> Download APK
            </a>
            <div style={{ marginTop: spacing.md, fontSize: 12, color: colors.textTertiary }}>
              Android 8.0+ · ~3.6 MB
            </div>
          </div>

          {/* Sideload instructions */}
          <div style={{
            background: `rgba(242, 120, 10, 0.05)`,
            border: `1px solid rgba(242, 120, 10, 0.2)`,
            borderRadius: borderRadius.md,
            padding: spacing.lg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
              <AlertTriangle size={15} color={colors.primary} />
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>How to install an APK</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {sideloadSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
                  <div style={{
                    flexShrink: 0, width: 24, height: 24,
                    borderRadius: '50%',
                    background: 'rgba(242,120,10,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: colors.primary,
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6, paddingTop: 3 }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ margin: `${spacing.md} 0 0`, fontSize: 12, color: colors.textTertiary, lineHeight: 1.5 }}>
              The exact path varies by device and Android version. Look for "Install unknown apps" or "Unknown sources" in your security settings.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${colors.glassBorder}`, marginBottom: spacing['3xl'] }} />

        {/* ── Desktop ── */}
        <div style={{ marginBottom: spacing['3xl'], opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Monitor size={20} color={colors.textSecondary} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>Windows Desktop</h2>
            <span style={{
              fontSize: 11, fontWeight: 700, color: colors.textSecondary,
              background: colors.surfaceHover ?? colors.surface,
              border: `1px solid ${colors.glassBorder}`,
              borderRadius: borderRadius.sm, padding: '2px 8px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>Work in progress</span>
          </div>

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

          {/* Desktop features */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
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

          <div style={{ background: `rgba(242, 120, 10,0.05)`, border: `1px solid rgba(242, 120, 10,0.15)`, borderRadius: borderRadius.md, padding: spacing.lg, fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
            <strong style={{ color: colors.textPrimary }}>First-time install:</strong> Windows may show a SmartScreen warning. Click <em>More info → Run anyway</em> to proceed. The app is safe — we're working on code signing.
          </div>
        </div>

      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </DiscoveryLayout>
  );
};
