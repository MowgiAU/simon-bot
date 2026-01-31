import React from 'react';
import { colors, spacing } from '../theme/theme';
import { TestTube } from 'lucide-react';

export const StagingTest: React.FC = () => {
  return (
    <div style={{ padding: spacing.xl, color: colors.textPrimary }}>
      <div style={{ 
        background: colors.surface, 
        padding: spacing.xl, 
        borderRadius: 8, 
        border: `1px solid ${colors.highlight}`,
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing.md }}>
          <div style={{ 
            background: 'rgba(255, 159, 28, 0.1)', 
            padding: spacing.md, 
            borderRadius: '50%',
            color: colors.highlight
          }}>
            <TestTube size={48} />
          </div>
        </div>
        
        <h1 style={{ marginBottom: spacing.md }}>Staging Environment</h1>
        <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>
          If you are seeing this page, you are successfully running the Staging Dashboard.
        </p>
        
        <div style={{ 
          marginTop: spacing.xl, 
          padding: spacing.md, 
          background: colors.background,
          borderRadius: 4,
          fontFamily: 'monospace',
          textAlign: 'left'
        }}>
           <strong>Test Command:</strong> Type <code>!staging</code> in your Discord server.
        </div>
      </div>
    </div>
  );
};
