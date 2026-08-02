# Deploying Floating Space to Vercel

This project is a TanStack Start SSR app. It builds through Nitro, which supports
Vercel natively via the Build Output API.

## What was configured

- `vite.config.ts` pins the Nitro `vercel` preset when `VERCEL=1` or
  `NITRO_PRESET=vercel` is present (Lovable hosting still builds for Cloudflare).
- `vercel.json` sets the build command, disables framework auto-detection and
  points Vercel at `.vercel/output` (Build Output API), so SSR routes — including
  `/` — are served by a function instead of returning 404.

## Steps

1. Import the GitHub repo in Vercel (New Project -> Import).
2. Framework Preset: **Other** (vercel.json already handles it).
3. Add Environment Variables (Production + Preview), copied from `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. Deploy. Build command is `npm run build`; no output directory override needed.

## Supabase auth

Auth runs against the same Supabase project through the browser client, so it
keeps working. In Supabase Auth settings add your Vercel URLs to
**Site URL / Redirect URLs**:

- `https://<your-app>.vercel.app`
- `https://<your-app>.vercel.app/auth/callback`
- any custom domain you attach

Google OAuth also needs the Vercel origin added in the Google Cloud console
authorized redirect URIs (the Supabase callback URL stays unchanged).
