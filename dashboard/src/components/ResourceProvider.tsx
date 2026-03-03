import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthProvider';

export interface DiscordChannel {
    id: string;
    name: string;
    type: number;
    parent_id?: string;
    position: number;
}

export interface DiscordRole {
    id: string;
    name: string;
    color: number;
    position: number;
    permissions: string;
    managed: boolean;
    hoist: boolean;
}

interface ResourceContextType {
    channels: DiscordChannel[];
    roles: DiscordRole[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

/**
 * Global Resource Provider to prevent redundant Discord API calls.
 * Fetches and stores channels/roles once per guild selection.
 */
export const ResourceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { selectedGuild } = useAuth();
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchResources = async () => {
        if (!selectedGuild) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const [channelsRes, rolesRes] = await Promise.all([
                fetch(`/api/guilds/${selectedGuild.id}/channels`),
                fetch(`/api/guilds/${selectedGuild.id}/roles`)
            ]);

            if (!channelsRes.ok || !rolesRes.ok) {
                throw new Error('Failed to fetch Discord resources');
            }

            const channelsData = await channelsRes.json();
            const rolesData = await rolesRes.json();

            setChannels(Array.isArray(channelsData) ? channelsData : []);
            setRoles(Array.isArray(rolesData) ? rolesData : []);
        } catch (err: any) {
            console.error('Resource fetch error:', err);
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    // Refetch whenever the guild changes
    useEffect(() => {
        if (selectedGuild) {
            fetchResources();
        } else {
            setChannels([]);
            setRoles([]);
        }
    }, [selectedGuild?.id]);

    const value = useMemo(() => ({
        channels,
        roles,
        loading,
        error,
        refresh: fetchResources
    }), [channels, roles, loading, error, selectedGuild?.id]);

    return (
        <ResourceContext.Provider value={value}>
            {children}
        </ResourceContext.Provider>
    );
};

export const useResources = () => {
    const context = useContext(ResourceContext);
    if (!context) {
        throw new Error('useResources must be used within a ResourceProvider');
    }
    return context;
};
