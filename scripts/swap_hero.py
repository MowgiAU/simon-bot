import re

with open('dashboard/src/pages/ArtistDiscovery.tsx', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

# Lines 288-579 (1-indexed) = indices 287-578 (0-indexed)
# Keep everything before line 288 and from line 580 onward
before = '\n'.join(lines[:287])
after = '\n'.join(lines[579:])

new_section = r"""
                    {/* ROW 1: BATTLE HERO / FEATURED TRACK */}

                    {/* Battle — big hero card (span 3) */}
                    {(() => {
                        const battle = featured?.featuredBattle;
                        const battleDesc = featured?.featuredBattleDescription;
                        const bgImg = battle?.bannerUrl || battle?.cardImageUrl;
                        const statusColor = battle?.status === 'voting' ? '#FBBF24' : battle?.status === 'active' ? '#34D399' : battle?.status === 'completed' ? '#94A3B8' : '#60A5FA';
                        const statusBg = battle?.status === 'voting' ? 'rgba(251,191,36,0.22)' : battle?.status === 'active' ? 'rgba(52,211,153,0.22)' : battle?.status === 'completed' ? 'rgba(100,116,139,0.22)' : 'rgba(96,165,250,0.22)';
                        const statusLabel = battle?.status === 'voting' ? 'VOTING' : battle?.status === 'active' ? 'LIVE' : battle?.status === 'completed' ? 'ENDED' : 'UPCOMING';
                        return (
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', minHeight: isMobile ? '300px' : undefined, position: 'relative', overflow: 'hidden', gridColumn: isMobile ? undefined : 'span 3', padding: 0 }}>
                        {bgImg && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                        <div style={{ position: 'absolute', inset: 0, background: bgImg
                            ? 'linear-gradient(to right, rgba(10,13,24,0.97) 30%, rgba(10,13,24,0.72) 60%, rgba(10,13,24,0.3) 100%), linear-gradient(to top, rgba(10,13,24,0.5) 0%, transparent 50%)'
                            : `linear-gradient(135deg, rgba(10,13,24,0.98) 0%, ${colors.primary}18 100%)`
                        }} />

                        {battle?.cardImageUrl && battle?.bannerUrl && !isMobile && (
                            <div style={{
                                position: 'absolute', right: '32px', top: '50%', transform: 'translateY(-50%)',
                                width: '190px', height: '190px', borderRadius: '16px', overflow: 'hidden',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)',
                            }}>
                                <img src={battle.cardImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}

                        <div style={{
                            position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            height: '100%', boxSizing: 'border-box',
                            padding: isMobile ? '24px 20px' : '28px 32px',
                            paddingRight: (battle?.cardImageUrl && battle?.bannerUrl && !isMobile) ? '248px' : (isMobile ? '20px' : '32px'),
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: colors.primary, background: `${colors.primary}25`, padding: '4px 10px', borderRadius: '4px' }}>
                                    <Swords size={10} />Beat Battle
                                </span>
                                {battle && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', backgroundColor: statusBg, color: statusColor, fontSize: '10px', fontWeight: 700, borderRadius: '999px', letterSpacing: '0.07em' }}>
                                        <span className={battle.status === 'active' ? 'new-drops-pulse' : undefined} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 }} />
                                        {statusLabel}
                                    </span>
                                )}
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 0' }}>
                                {battle ? (
                                    <>
                                        <Link to={`/battles/${battle.id}`} style={{ textDecoration: 'none' }}>
                                            <h2
                                                style={{ fontSize: isMobile ? '26px' : '36px', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.1, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                            >{battle.title}</h2>
                                        </Link>
                                        {battleDesc && (
                                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 14px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>{battleDesc}</p>
                                        )}
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const, marginBottom: '10px' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                                <Users size={12} />{battle._count?.entries ?? 0} {(battle._count?.entries ?? 0) === 1 ? 'entry' : 'entries'}
                                            </span>
                                            {battle.status === 'voting' && battle.votingEnd && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#FBBF24' }}>
                                                    <Timer size={12} />Voting closes {new Date(battle.votingEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                            {battle.status === 'active' && battle.submissionEnd && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#34D399' }}>
                                                    <Timer size={12} />Submissions close {new Date(battle.submissionEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                        {battle.prizes && battle.prizes.length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                                {battle.prizes.slice(0, 3).map((p, i) => (
                                                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.07)', borderRadius: '6px', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <span>{i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : '\u{1F949}'}</span>
                                                        {p.title ? <span style={{ color: colors.primary, fontWeight: 700 }}>{p.title}</span> : <span>{p.description}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center' as const }}>
                                        <Swords size={40} color={colors.textSecondary} style={{ opacity: 0.15, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                                        <p style={{ fontSize: '16px', color: colors.textSecondary, margin: '0 0 6px' }}>No battle running right now</p>
                                        <Link to="/battles" style={{ fontSize: '13px', color: colors.primary, textDecoration: 'none', fontWeight: 600 }}>View past battles →</Link>
                                    </div>
                                )}
                            </div>

                            {battle && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '10px' }}>
                                    {battle.sponsor ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                                            {battle.sponsor.logoUrl && <img src={battle.sponsor.logoUrl} alt="" style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'contain' }} />}
                                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Sponsored by <strong style={{ color: 'white' }}>{battle.sponsor.name}</strong></span>
                                        </div>
                                    ) : <div />}
                                    <Link to={`/battles/${battle.id}`} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                                        fontSize: '13px', fontWeight: 700, textDecoration: 'none', color: 'white',
                                        backgroundColor: battle.status === 'voting' ? '#FBBF24' : battle.status === 'completed' ? 'rgba(100,116,139,0.6)' : colors.primary,
                                        padding: '11px 22px', borderRadius: '8px',
                                        boxShadow: battle.status === 'voting' ? '0 4px 20px rgba(251,191,36,0.4)' : battle.status === 'completed' ? 'none' : `0 4px 20px ${colors.primary}55`,
                                    }}>
                                        {battle.status === 'voting' ? <><Trophy size={14} /> Vote Now</> : battle.status === 'active' ? <><Swords size={14} /> Submit a Beat</> : battle.status === 'completed' ? 'View Results →' : 'View Battle →'}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                        );
                    })()}

                    {/* Featured Track/Artist/Playlist — compact card (span 1) */}
                    <div style={{ ...panel, height: isMobile ? 'auto' : '400px', minHeight: isMobile ? '220px' : undefined, position: 'relative', overflow: 'hidden', padding: 0 }}>
                        {heroCover && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                        <div style={{ position: 'absolute', inset: 0, background: heroCover
                            ? 'linear-gradient(to bottom, rgba(10,13,24,0.3) 0%, rgba(10,13,24,0.5) 35%, rgba(10,13,24,0.96) 100%)'
                            : 'rgba(10,13,24,0.98)'
                        }} />

                        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '18px', boxSizing: 'border-box' as const }}>
                            <div>
                                <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: colors.primary, background: `${colors.primary}25`, padding: '4px 10px', borderRadius: '4px' }}>
                                    {heroLabel}
                                </span>
                            </div>

                            <div>
                                {heroType !== 'track' && heroTrackList.length > 0 && (
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
                                        {heroTrackList.slice(0, 3).map((t, i) => (
                                            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(6px)', borderRadius: '5px', padding: '3px 7px 3px 4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                {t.coverUrl && <div style={{ width: '16px', height: '16px', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}><img src={t.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                                                <span style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' as const, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.8)' }}>{t.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <h3 style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px', lineHeight: 1.15, color: '#fff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                    {heroType === 'track' && heroTrack ? (
                                        <Link to={`/track/${heroTrack.profile.username}/${heroTrack.slug || heroTrack.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                        >{heroTitle}</Link>
                                    ) : heroType === 'artist' && heroArtist ? (
                                        <Link to={`/profile/${heroArtist.username}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                        >{heroTitle}</Link>
                                    ) : heroType === 'playlist' && heroPlaylist ? (
                                        <Link to={`/playlists/${heroPlaylist.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                        >{heroTitle}</Link>
                                    ) : heroTitle}
                                </h3>
                                {heroSubtitle && (
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                        {heroType === 'track' && heroTrack ? (
                                            <Link to={`/profile/${heroTrack.profile.username}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                            >{heroSubtitle}</Link>
                                        ) : heroType === 'playlist' && heroPlaylist?.profile ? (
                                            <Link to={`/profile/${heroPlaylist.profile.username}`} style={{ color: 'inherit', textDecoration: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                            >{heroSubtitle}</Link>
                                        ) : heroSubtitle}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {heroType === 'artist' && heroArtist && (
                                        <Link to={`/profile/${heroArtist.username}`} style={{
                                            flex: 1, backgroundColor: colors.primary, color: 'white', padding: '10px 14px',
                                            borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            boxShadow: `0 4px 16px ${colors.primary}50`,
                                        }}>
                                            <Mic2 size={13} /> Explore
                                        </Link>
                                    )}
                                    <button onClick={handleHeroPlay} style={{
                                        flex: 1,
                                        backgroundColor: heroType === 'artist' ? 'rgba(255,255,255,0.1)' : colors.primary,
                                        color: 'white', padding: '10px 14px', borderRadius: '8px',
                                        border: heroType === 'artist' ? '1px solid rgba(255,255,255,0.15)' : 'none',
                                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        boxShadow: heroType === 'artist' ? 'none' : `0 4px 16px ${colors.primary}50`,
                                    }}>
                                        {isHeroPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                                        {isHeroPlaying ? 'Pause' : 'Play'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>"""

result = before + new_section + '\n' + after

with open('dashboard/src/pages/ArtistDiscovery.tsx', 'w', encoding='utf-8') as f:
    f.write(result)
print("Done.")
