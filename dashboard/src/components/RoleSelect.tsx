import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';

interface Role {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

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
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        fetch(`/api/guilds/${guildId}/roles`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch roles');
                return res.json();
            })
            .then((data: Role[]) => {
                if (!Array.isArray(data)) {
                    console.error('Role API response is not an array:', data);
                    setRoles([]);
                    return;
                }
                // Sort by position (descending) so highest roles are at top, usually preferred
                // Unless @everyone (position 0)
                const sorted = data.sort((a,b) => b.position - a.position);
                setRoles(sorted);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [guildId]);

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
            {roles.map(role => (
                <option key={role.id} value={role.id}>
                    {role.name}
                </option>
            ))}
            {loading && <option disabled>Loading roles...</option>}
        </select>
    );
};
