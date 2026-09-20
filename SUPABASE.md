# Supabase setup (required)

FuelLog uses **Supabase only** (no local demo). Phone and laptop sync with the same account.

## 1. Create project

1. https://supabase.com → New project  
2. SQL Editor → run in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_weight_entries.sql`
   - `supabase/migrations/003_library_and_micros.sql`
3. Authentication → Providers → enable **Email**

## 2. Local development keys

Edit `src/environments/environment.development.ts`:

```ts
export const environment = {
  production: false,
  useSupabase: true,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  usdaApiKey: 'DEMO_KEY',
  timezone: 'Asia/Kolkata',
};
```

Keys: Project Settings → API → Project URL + `anon` `public` key.

## 3. Run locally

```bash
npm install
npm start
```

Open http://localhost:4200 — create an account and sign in.

Phone on same Wi‑Fi:

```bash
npm start -- --host 0.0.0.0
```

Use `http://YOUR_LAN_IP:4200`. Camera may need HTTPS; photo upload / manual barcode still work.

## 4. Production

See [DEPLOY.md](DEPLOY.md).
