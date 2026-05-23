// Reads .env and writes src/environments/environment.ts
// Run automatically before `ng serve` / `ng build` via package.json scripts.
const fs   = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const get = (key, fallback = '') => process.env[key] || fallback;

const isProd = process.env['NODE_ENV'] === 'production';

const content = `// AUTO-GENERATED — do not edit by hand. Edit .env instead.
export const environment = {
  production: ${isProd},
  apiUrl:     '${get('API_URL', 'http://localhost:4001/api/v1')}',
  wsUrl:      '${get('WS_URL',  'http://localhost:4001')}',
  googleApiKey: '${get('GOOGLE_API_KEY')}',
};
`;

const outPath = path.resolve(__dirname, '../src/environments/environment.ts');
fs.writeFileSync(outPath, content, 'utf8');
console.log('[set-env] wrote', outPath);
