import React, { useEffect, useState } from 'react';
import { colors, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User } from 'lucide-react';
import { MusicianProfilePublic } from './MusicianProfilePublic';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { useMobile } from '../hooks/useMobile';
import { ProfileMobile } from '../components/mobile/ProfileMobile';

interface ProfileData {
    id?: string;
    username?: string;
    displayName?: string | null;
    avatar?: string | null;
    bio: string | null;
    genres: { id: string; name: string }[];
}

export const MusicianProfilePage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const isMobile = useMobile(1024);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    const pathParts = pathname.split('/');
    const urlIdentifier = pathParts.length > 2 ? pathParts[2] : null;

    // /profile with no username + logged-in → check if profile exists first
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const identifier = urlIdentifier || user?.id;
                if (!identifier) { if (!authLoading) setLoading(false); return; }
                const res = await axios.get(`/api/musician/profile/${identifier}`, { withCredentials: true });
                const data = res.data;

                if (data && data.socials && Array.isArray(data.socials)) {
                    data.socials.forEach((s: any) => {
                        if (s.platform === 'spotify') data.spotifyUrl = s.url;
                        if (s.platform === 'soundcloud') data.soundcloudUrl = s.url;
                        if (s.platform === 'youtube') data.youtubeUrl = s.url;
                        if (s.platform === 'instagram') data.instagramUrl = s.url;
                        if (s.platform === 'discord') data.discordUrl = s.url;
                    });
                }
                if (data && data.genres) {
                    data.genres = data.genres.map((pg: any) => ({ id: pg.genreId, name: pg.genre?.name || 'Unknown' }));
                }
                setProfile(data);
            } catch (err: any) {
                if (err.response?.status === 404 && !urlIdentifier && user) {
                    navigate('/profile/setup', { replace: true });
                    return;
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.id, urlIdentifier]);

    if (loading || authLoading) return (
        <DiscoveryLayout activeTab="profile">
            <div style={{ color: colors.textSecondary, padding: spacing.xl }}>Loading profile...</div>
        </DiscoveryLayout>
    );

    if (!user && !urlIdentifier) {
        return (
            <DiscoveryLayout activeTab="profile">
                <div style={{ textAlign: 'center', padding: '100px', color: colors.textPrimary }}>
                    <User size={64} color={colors.primary} style={{ marginBottom: spacing.xl, opacity: 0.5 }} />
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Sign in to view your profile</h2>
                    <button
                        onClick={() => window.location.href = '/login'}
                        style={{ backgroundColor: colors.primary, color: 'white', border: 'none', padding: '12px 32px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        Sign In
                    </button>
                </div>
            </DiscoveryLayout>
        );
    }

    const identifier = urlIdentifier || user?.profileUsername || user?.username || user?.id || '';
    const isOwn = !!user && (
        identifier === user.id ||
        identifier === user.username ||
        (!!user.profileUsername && identifier === user.profileUsername) ||
        (!!profile && (profile as any).userId === user.id)
    );

    if (isMobile) {
        return (
            <DiscoveryLayout activeTab="profile">
                <ProfileMobile identifier={identifier} />
            </DiscoveryLayout>
        );
    }

    return (
        <DiscoveryLayout activeTab="profile">
            <MusicianProfilePublic
                identifier={identifier}
                isOwnProfile={isOwn}
                onEdit={() => navigate('/profile/edit')}
                initialProfile={profile}
            />
        </DiscoveryLayout>
    );
};
