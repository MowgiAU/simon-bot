/**
 * Lets the site's own pages upload straight to the R2 bucket.
 *
 *   npx tsx scripts/set-r2-cors.ts [origin ...]
 *
 * Without arguments it allows the production site and local development.
 */
import 'dotenv/config';
import { R2Storage } from '../src/services/R2Storage.js';

const origins = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['https://fujistud.io', 'https://www.fujistud.io', 'https://staging.fujistud.io:3000', 'http://localhost:5173'];

if (!R2Storage.isConfigured()) {
    console.error('R2 is not configured (check R2_* in .env)');
    process.exit(1);
}
await R2Storage.setCorsOrigins(origins);
console.log('allowed origins:', origins.join(', '));
