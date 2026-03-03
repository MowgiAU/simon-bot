import React, { useMemo } from 'react';
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
    const { roles, loading } = useResources();

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
        <select
            multiple={multiple}
            value={value}
            onChange={handleChange}
            style={{
                width: '100%',
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
    );
};
