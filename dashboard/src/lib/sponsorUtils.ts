/** Append a ref/source parameter to an outgoing sponsor URL */
export function appendSponsorRef(url: string | null | undefined, page: string): string {
    if (!url) return '#';
    const ref = `fujistud.io${page}`;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}ref=${encodeURIComponent(ref)}`;
}

/** Fire-and-forget click tracking for website URL clicks */
export function trackSponsorClick(sponsorId: string, page: string, apiBase = '') {
    fetch(`${apiBase}/api/beat-battle/sponsors/${sponsorId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
        credentials: 'include',
    }).catch(() => {});
}

/** Fire-and-forget click tracking for promo link clicks */
export function trackPromoLinkClick(linkId: string, page: string, apiBase = '') {
    fetch(`${apiBase}/api/beat-battle/sponsor-links/${linkId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
        credentials: 'include',
    }).catch(() => {});
}

/** Fire-and-forget impression tracking */
export function trackSponsorView(sponsorId: string, apiBase = '') {
    fetch(`${apiBase}/api/beat-battle/sponsors/${sponsorId}/view`, {
        method: 'POST',
        credentials: 'include',
    }).catch(() => {});
}
