# Supabase setup (required)

FuelLog uses **Supabase only** (no local demo). Phone and laptop sync with the same account.

**Secrets stay out of GitHub.** Keys live in a local `.env` file and in Vercel Environment Variables. A small script writes them into Angular env files only on your machine / during the Vercel build.

## 1. Create project

1. https://supabase.com → New project  
2. SQL Editor → run in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_weight_entries.sql`
   - `supabase/migrations/003_library_and_micros.sql`
3. Authentication → Providers → enable **Email**

## 2. Local keys (`.env`, not git)

1. Copy the template:

```bash
cp .env.example .env
```

2. Fill in from Supabase → **Project Settings** → **API**:
   - `SUPABASE_URL` = Project URL (`https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` = `anon` `public` key  

3. Start the app (loads `.env` automatically):

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

## 3. Production (Vercel)

Do **not** put keys in files you commit. Set them in Vercel — see [DEPLOY.md](DEPLOY.md).

## Notes

- The `anon` key is safe for the browser when RLS is enabled; never put the `service_role` key in the app or `.env` used for frontend builds.
- After `npm start` / `npm run build`, `src/environments/environment.*.ts` may contain keys locally — **do not commit those changes**. Committed copies stay empty placeholders. Reset with:

```bash
git checkout -- src/environments/environment.development.ts src/environments/environment.production.ts
```
