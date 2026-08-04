/**
 * Alt F — Mobile library (/library on phones).
 *
 * The "main tracks page": the same shorts feed as home, but with the browsing
 * controls the desktop library has — search, sort and a genre filter — driving
 * the feed's params instead of a grid.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, X, Flame, Clock, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { AltSidebar, PRIMARY, SUB, TEXT, BORDER, FONT, arr } from '../components/altshell/AltSidebar';
import { TrackFeed } from '../components/altshell/trackfeed/TrackFeed';
import { FeedSort, genreAccent } from '../components/altshell/trackfeed/types';

const SORTS: { key: FeedSort; label: string; icon: typeof Flame }[] = [
    { key: 'feed',  label: 'For you', icon: Flame },
    { key: 'new',   label: 'Newest',  icon: Clock },
    { key: 'plays', label: 'Played',  icon: TrendingUp },
];

export const FrontpageAltFLibraryFeed: React.FC = () => {
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [sort, setSort] = useState<FeedSort>('feed');
    const [genre, setGenre] = useState<string | null>(null);
    const [genres, setGenres] = useState<any[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);

    useEffect(() => { document.title = 'Fuji Studio | Library'; }, []);

    // Typing shouldn't refetch on every keystroke
    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        axios.get('/api/musician/genres')
            .then(r => setGenres(arr(r.data).filter((g: any) => (g._count?.tracks || 0) > 0).slice(0, 30)))
            .catch(() => setGenres([]));
    }, []);

    const params = useMemo(() => ({
        search: debounced || undefined,
        sort,
        genre: genre || undefined,
    }), [debounced, sort, genre]);

    const activeGenreName = genre ? genres.find(g => g.slug === genre)?.name : null;

    const chips = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9999, background: 'rgba(0,0,0,0.45)', border: `1px solid ${BORDER}`, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                    <Search size={14} color={SUB} style={{ flexShrink: 0 }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search tracks and artists"
                        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: FONT }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, display: 'flex', padding: 0 }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button onClick={() => setFiltersOpen(o => !o)} aria-label="Filters"
                    style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${(filtersOpen || genre) ? PRIMARY : BORDER}`, background: (filtersOpen || genre) ? `${PRIMARY}28` : 'rgba(0,0,0,0.45)', color: (filtersOpen || genre) ? PRIMARY : '#fff' }}>
                    <SlidersHorizontal size={15} />
                </button>
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: 6 }}>
                {SORTS.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setSort(key)} style={chipStyle(sort === key)}>
                        <Icon size={11} /> {label}
                    </button>
                ))}
                {activeGenreName && (
                    <button onClick={() => setGenre(null)} style={{ ...chipStyle(true), marginLeft: 'auto' }}>
                        {activeGenreName} <X size={11} />
                    </button>
                )}
            </div>

            {/* Genre picker */}
            {filtersOpen && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 132, overflowY: 'auto', paddingBottom: 2 }}>
                    <button onClick={() => { setGenre(null); setFiltersOpen(false); }} style={chipStyle(!genre)}>All genres</button>
                    {genres.map((g: any) => {
                        const on = genre === g.slug;
                        const accent = genreAccent(g.name);
                        return (
                            <button key={g.id} onClick={() => { setGenre(on ? null : g.slug); setFiltersOpen(false); }}
                                style={{ ...chipStyle(on), ...(on ? { background: accent, borderColor: accent, color: '#0b0e16' } : { color: accent, borderColor: `${accent}66` }) }}>
                                {g.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div style={{ background: '#06080e', color: TEXT, fontFamily: FONT, minHeight: '100vh' }}>
            <TrackFeed
                params={params}
                title={activeGenreName || (debounced ? `“${debounced}”` : 'Library')}
                createLink="/upload"
                headerExtra={chips}
                emptyMessage={debounced ? 'No tracks matched that search.' : 'No tracks in this genre yet.'}
            />
            <AltSidebar active="Search" />
        </div>
    );
};

const chipStyle = (on: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 9999,
    border: `1px solid ${on ? PRIMARY : 'rgba(255,255,255,0.16)'}`,
    background: on ? PRIMARY : 'rgba(0,0,0,0.45)',
    color: on ? '#fff' : TEXT, fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
});
