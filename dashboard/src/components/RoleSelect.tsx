import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useResources } from './ResourceProvider';

interface RoleSelectProps {
    guildId: string;
    value: string | string[]; // ID or array of IDs
    onChange: (value: string | string[]) => void;
    placeholder?: string;
    multiple?: boolean;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({
    guildId,
    value,
    onChange,
    placeholder = "Select Role",
    multiple = false
}) => {
    const { roles, loading, refresh } = useResources();

    const filteredRoles = useMemo(() => {
        // Sort by position (descending) so highest roles are at top
        return [...roles].sort((a, b) => b.position - a.position);
    }, [roles]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (multiple) {
            const options = Array.from(e.target.selectedOptions, option => option.value);
            onChange(options);
        } else {
            onChange(e.target.value);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '6px', alignItems: multiple ? 'stretch' : 'center' }}>
            <select
                multiple={multiple}
                value={value}
                onChange={handleChange}
                style={{
                    flex: 1,
                    minWidth: 0,
                    padding: spacing.sm,
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors.border}`,
                    outline: 'none',
                    minHeight: multiple ? '100px' : 'auto'
                }}
            >
                {!multiple && <option value="">{placeholder}</option>}
                {filteredRoles.map(role => (
                    <option key={role.id} value={role.id}>
                        {role.name}
                    </option>
                ))}
                {loading && <option disabled>Loading resources...</option>}
            </select>
            <button
                type="button"
                onClick={() => refresh(true)}
                disabled={loading}
                title="Refresh role list from Discord — picks up a role created since this page loaded"
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '32px', flexShrink: 0,
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.md,
                    color: colors.textSecondary,
                    cursor: loading ? 'default' : 'pointer',
                }}
            >
                <RefreshCw size={14} className={loading ? 'spin' : undefined} />
            </button>
        </div>
    );
};
