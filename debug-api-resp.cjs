const https = require('https');
https.get('https://fujistud.io/api/beat-battle/battles/cmo9mgq3z004hg3noqnto1mtv', (resp) => {
    let body = '';
    resp.on('data', c => body += c);
    resp.on('end', () => {
        const d = JSON.parse(body);
        console.log('status:', d.status);
        console.log('entries keys (first):', Object.keys((d.entries || [])[0] || {}));
        for (const e of d.entries || []) {
            console.log(e.track?.title, 'vc=', e.voteCount, '1=', e.firstPlaceVotes, '2=', e.secondPlaceVotes, '3=', e.thirdPlaceVotes);
        }
    });
});
