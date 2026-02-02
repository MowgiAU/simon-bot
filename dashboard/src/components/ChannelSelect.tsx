import React, { useEffect, useState } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';

interface Channel {
    id: string;
    name: string;
    type: number;
    parentId?: string;
}

interface ChannelSelectProps {
    guildId: string;
    value: string | string[]; // ID or array of IDs
    onChange: (value: string | string[]) => void;
    placeholder?: string;
    multiple?: boolean;
    channelTypes?: number[]; // Filter by specific types (e.g. [0] for text only)
}

export const ChannelSelect: React.FC<ChannelSelectProps> = ({ 
    guildId, 
    value, 
    onChange, 
    placeholder = "Select Channel", 
    multiple = false,
    channelTypes 
}) => {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        fetch(`/api/guilds/${guildId}/channels`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch channels');
                return res.json();
            })
            .then((data: Channel[]) => {
                if (!Array.isArray(data)) {
                    console.error('Channel API response is not an array:', data);
                    setChannels([]);
                    return;
                }
                let filtered = data;
                if (channelTypes) {
                    filtered = data.filter(c => channelTypes.includes(c.type));
                }
                setChannels(filtered);
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

    const getIcon = (type: number) => {
        switch(type) {
            case 0: return '#'; // Text
            case 2: return '🔊'; // Voice
            case 4: return '📁'; // Category
            case 15: return '💬'; // Forum
            default: return '';
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
            {channels.map(channel => (
                <option key={channel.id} value={channel.id}>
                    {getIcon(channel.type)} {channel.name}
                </option>
            ))}
            {loading && <option disabled>Loading channels...</option>}
        </select>
    );
};
