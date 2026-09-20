# Deploy FuelLog to production

## Prerequisites

1. Supabase project ready (see [SUPABASE.md](SUPABASE.md)) — run all 3 SQL migrations  
2. GitHub repo with this code pushed  
3. Accounts: [Vercel](https://vercel.com) + [Supabase](https://supabase.com)

## 1. Put production keys in the build

Edit `src/environments/environment.production.ts`:

```ts
export const environment = {
  production: true,
  useSupabase: true,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  usdaApiKey: 'DEMO_KEY', // or your USDA key
  timezone: 'Asia/Kolkata',
};
```

**Do not commit real secrets to a public repo.** Prefer a private GitHub repo, or inject keys in CI before `ng build`.

Optional: add `src/environments/environment.development.ts` with your **dev** keys for local `npm start`.

## 2. Deploy on Vercel (recommended)

1. Go to https://vercel.com → **Add New Project** → import your GitHub repo  
2. Framework: leave as Other / Angular  
3. Build settings (usually auto from `vercel.json`):
   - Build command: `npm run build`
   - Output directory: `dist/diet-tracker/browser`
4. Deploy  
5. Open the `*.vercel.app` URL on phone and laptop — same Supabase login syncs data  

SPA routing is handled by `vercel.json` rewrites.

### Redeploy

Push to `main` (or connect Vercel to your branch) — each push rebuilds production.

## 3. Supabase Auth for production

In Supabase → Authentication → URL configuration:

- **Site URL**: your Vercel URL (e.g. `https://fuellog.vercel.app`)  
- **Redirect URLs**: add the same origin  

Email confirmations: under Auth providers, you can disable “Confirm email” while testing, then enable for real users.

## 4. Local production build smoke test

```bash
npm run build
npx serve dist/diet-tracker/browser
```

## 5. Cloudflare Pages (alternative)

- Build: `npm run build`  
- Output: `dist/diet-tracker/browser`  
- Add a `_redirects` or SPA fallback to `index.html`

## Checklist

- [ ] Migrations `001`, `002`, `003` applied  
- [ ] Email auth enabled  
- [ ] Production env has real Supabase URL + anon key  
- [ ] Vercel deploy succeeds  
- [ ] Sign up / sign in works on phone over HTTPS (camera scan works on HTTPS)
