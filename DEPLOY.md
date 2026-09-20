# Deploy FuelLog to production

## Prerequisites

1. Supabase project ready (see [SUPABASE.md](SUPABASE.md)) — run all 3 SQL migrations  
2. GitHub repo with this code pushed (**no secrets in the repo**)  
3. Accounts: [Vercel](https://vercel.com) + [Supabase](https://supabase.com)

## 1. Secrets on Vercel (not in GitHub)

In Vercel → your project → **Settings** → **Environment Variables**, add for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_ANON_KEY` | your Supabase `anon` `public` key |
| `USDA_API_KEY` | optional; defaults to `DEMO_KEY` |

`npm run build` runs `scripts/set-env.mjs`, which reads these vars and writes Angular env files **during the Vercel build only**. Nothing sensitive needs to be committed.

Locally, use a gitignored `.env` instead (see SUPABASE.md).

## 2. Deploy on Vercel

1. Go to https://vercel.com → **Add New Project** → import your GitHub repo  
2. Framework: leave as Other / Angular  
3. Build settings (usually auto from `vercel.json`):
   - Build command: `npm run build`
   - Output directory: `dist/diet-tracker/browser`
4. Ensure the env vars from step 1 are set **before** the first successful deploy (or **Redeploy** after adding them)  
5. Open the `*.vercel.app` URL on phone and laptop — same Supabase login syncs data  

SPA routing is handled by `vercel.json` rewrites.

### Redeploy

Push to `main` (or connect Vercel to your branch) — each push rebuilds production.  
If you only change env vars, use **Deployments → … → Redeploy**.

### Readable URL

Vercel → **Settings** → **General** → **Project Name** (e.g. `fuellog`) → URL becomes `https://fuellog.vercel.app`. Rename may fail if the name is already taken by another project.

## 3. Supabase Auth for production

In Supabase → Authentication → URL configuration:

- **Site URL**: your Vercel URL (e.g. `https://fuellog.vercel.app`)  
- **Redirect URLs**: add the same origin (e.g. `https://fuellog.vercel.app/**`) and `http://localhost:4200/**` for local  

Email confirmations: under Auth providers, you can disable “Confirm email” while testing, then enable for real users.

## 4. Local production build smoke test

```bash
cp .env.example .env   # if needed, then fill keys
npm run build
npx serve dist/diet-tracker/browser
```

## 5. Cloudflare Pages (alternative)

- Build: `npm run build` (set the same env vars in the host’s dashboard)  
- Output: `dist/diet-tracker/browser`  
- Add a `_redirects` or SPA fallback to `index.html`

## Checklist

- [ ] Migrations `001`, `002`, `003` applied  
- [ ] Email auth enabled  
- [ ] Vercel env vars `SUPABASE_URL` + `SUPABASE_ANON_KEY` set  
- [ ] Vercel deploy succeeds (no “missing SUPABASE_URL” build error)  
- [ ] Supabase Site URL matches your Vercel URL  
- [ ] Sign up / sign in works on phone over HTTPS (camera scan works on HTTPS)
