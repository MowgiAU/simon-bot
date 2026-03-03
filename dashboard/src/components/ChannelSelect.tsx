import React, { useMemo } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useResources } from './ResourceProvider';

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
    const { channels, loading } = useResources();

    const filteredChannels = useMemo(() => {
        if (!channelTypes) return channels;
        return channels.filter(c => channelTypes.includes(c.type));
    }, [channels, channelTypes]);

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
            case 5: return '📢'; // News/Announcement
            case 13: return '🎤'; // Stage
            case 15: return '💬'; // Forum
            case 16: return '🖼️'; // Media
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
            {filteredChannels.map(channel => (
                <option key={channel.id} value={channel.id}>
                    {getIcon(channel.type)} {channel.name}
                </option>
            ))}
            {loading && <option disabled>Loading resources...</option>}
        </select>
    );
};
