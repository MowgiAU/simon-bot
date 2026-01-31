# Infrastructure Details

## Production
- **IP:** 143.198.51.52
- **Host Alias:** simon-bot-main (likely configured in .ssh/config usually, or just user terminology)

## Staging
- **Domain:** [staging.fujistud.io](http://staging.fujistud.io:3000)
- **IP:** 143.198.136.83
- **SSH Command:** `ssh root@143.198.136.83`
- **Database:** PostgreSQL
- **Bot Branch:** `staging`

## Notes
- Production deployment is currently manual or partly automated?
- Staging deployment is configured via GitHub Actions (staging.yml).
