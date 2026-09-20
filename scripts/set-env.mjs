/**
 * Writes Angular environment files from process.env / local .env.
 * Secrets stay out of git — set them in .env (local) or Vercel env vars (prod).
 *
 * Required: SUPABASE_URL, SUPABASE_ANON_KEY
 * Optional: USDA_API_KEY (defaults to DEMO_KEY)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv() {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const supabaseUrl = (process.env['SUPABASE_URL'] ?? '').trim();
const supabaseAnonKey = (process.env['SUPABASE_ANON_KEY'] ?? '').trim();
const usdaApiKey = (process.env['USDA_API_KEY'] ?? 'DEMO_KEY').trim() || 'DEMO_KEY';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[set-env] Missing SUPABASE_URL or SUPABASE_ANON_KEY.\n' +
      '  Local: copy .env.example → .env and fill in values.\n' +
      '  Vercel: Project → Settings → Environment Variables.'
  );
  process.exit(1);
}

function writeEnvFile(fileName, production) {
  const contents = `export const environment = {
  production: ${production},
  useSupabase: true,
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
  usdaApiKey: ${JSON.stringify(usdaApiKey)},
  timezone: 'Asia/Kolkata',
};
`;
  const path = resolve(process.cwd(), 'src/environments', fileName);
  writeFileSync(path, contents, 'utf8');
  console.log(`[set-env] Wrote ${fileName}`);
}

writeEnvFile('environment.development.ts', false);
writeEnvFile('environment.production.ts', true);
