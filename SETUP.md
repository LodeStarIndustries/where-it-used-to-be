# Setup

Everything Mike needs to do by hand to run **Where It Used To Be**, in order. Steps marked **(Milestone 3)** can wait until sign-in is built, but they're listed here so nothing is missed.

## What you'll end up with

| Piece | Dev | Production |
| --- | --- | --- |
| Supabase project | `wiutb-dev` (gets `TEST:` fixtures) | `wiutb-prod` (starts empty) |
| Used by | Your Mac (`npm run dev`) and every Vercel **preview** deployment | The Vercel **production** deployment |
| `app_settings.environment` | `development` | `production` |

The database itself enforces hard rule 8: a name starting with `TEST:` can only be saved in a database whose `environment` is `development`. A new database starts as `unset`, which also blocks them.

## 1. Tools on your Mac

- Node.js 24 or newer (you have 26). Check with `node --version`.
- Everything else (Next.js, the Supabase CLI) installs with the project:

```bash
npm install
```

## 2. Create the two Supabase projects

On [supabase.com/dashboard](https://supabase.com/dashboard), create two free projects:

1. Name `Where It Used To Be (dev)`. Region **Canada (Central)** (under **Need a specific region?**). Save the database password in your password manager.
2. Name `Where It Used To Be (prod)`. Same region, a different password.

Use the same settings for both:

| Setting | Choice | Why |
| --- | --- | --- |
| GitHub | Leave empty | Migrations are pushed with `npm run db:push:*`, so production changes stay deliberate |
| Enable Data API | On | The app talks to the database through it |
| Grant API access to new tables automatically | Off | The migrations grant exactly what each role needs |
| Enable RLS on new tables automatically | On | A safety net; the migrations turn RLS on for every table anyway |
| Postgres type | Postgres (default) | |

For each project, note these from the dashboard (**Project Settings**):

- **Project ref**: the ID in the project URL, `https://supabase.com/dashboard/project/<ref>`.
- **Project URL**: `https://<ref>.supabase.co`.
- **Publishable key** (starts `sb_publishable_`), under **API Keys**.
- **Secret key** (starts `sb_secret_`), under **API Keys**. Treat it like a password: it bypasses all security rules.

Free projects pause after about a week with no activity. If the dev project pauses, open it in the dashboard and press **Restore**.

## 3. Create a Supabase access token

The project's `npm run db:*` scripts sign in to Supabase with a personal access token, so you don't need the CLI's browser login.

1. Open [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
2. **Generate new token**, named `where-it-used-to-be cli`. Copy it. Supabase shows it only once.

## 4. Fill in `.env.local`

If it doesn't exist yet:

```bash
cp .env.example .env.local
```

Fill in:

- The **dev** project's URL, publishable key and secret key.
- Both project refs.
- `SUPABASE_ACCESS_TOKEN`: the token from step 3.
- `SUPABASE_DEV_DB_PASSWORD`: the dev project's database password.

Never put production keys or the production database password in `.env.local`. The production push asks for its password each time.

No code editor? This asks for the token, dev password and dev secret key with typing hidden, and writes them into `.env.local` (press Enter to keep a value):

```bash
npm run env:cli-secrets
```

## 5. Push the database schema

```bash
npm run db:push:dev
```

```bash
npm run db:push:prod
```

The production push asks you to type `production`, then the production database password (it isn't shown or saved).

## 6. Tell each database what it is

In the Supabase dashboard, open **SQL Editor** in the **dev** project and run:

```sql
update public.app_settings set environment = 'development';
```

Then in the **prod** project:

```sql
update public.app_settings set environment = 'production';
```

## 7. Load the `TEST:` fixtures into dev

```bash
npm run db:fixtures
```

This loads 25 made-up live places (every name starts with `TEST:`), one draft without a pin, and their sites. It refuses to run against production twice over: the script checks the project ref, and the SQL refuses unless the database says `development`. It's safe to run again.

## 8. Check it locally

```bash
npm run dev
```

Open <http://localhost:3000>. The **Setup check** card should say **Database: connected (development)** and **All good.**

## 9. Put the code on GitHub

1. On [github.com/new](https://github.com/new), create a **private** repository named `where-it-used-to-be`. Don't add a README, licence or `.gitignore` (the project has them).
2. Connect this folder to it and push (Claude makes the first commit when you say so):

```bash
git remote add origin https://github.com/YOUR-USERNAME/where-it-used-to-be.git
```

```bash
git push -u origin main
```

## 10. Connect Vercel

1. On [vercel.com/new](https://vercel.com/new), import the GitHub repository. Framework: **Next.js** (detected). Leave the build settings alone.
2. Before the first deploy, open **Environment Variables** and add the three app variables twice, once per environment:

| Variable | Production (tick **Production** only) | Preview (tick **Preview** only) |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | dev project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | prod publishable key | dev publishable key |
| `SUPABASE_SECRET_KEY` | prod secret key, marked **Sensitive** | dev secret key, marked **Sensitive** |

3. Deploy. Production lands on `https://<project-name>.vercel.app`. Every other branch you push gets its own preview URL, wired to the dev database.

**Check it:** open `/api/health` on both the production URL and a preview URL. Production should say `"ok": true`; a preview should also show `"databaseEnvironment": "development"`. If a deployment is pointed at the wrong database, the home page and `/api/health` say so.

## 11. Sign-in setup (Milestone 3)

### Google OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project named `Where It Used To Be`.
2. **Google Auth Platform → Branding**: app name `Where It Used To Be`, your support email. Under **Authorized domains**, add `supabase.co`.
3. **Audience**: External. Publish the app when you're ready for anyone to sign in (until then only listed test users can).
4. **Clients → Create client**: type **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` and `https://<project-name>.vercel.app`.
   - Authorized redirect URIs: both Supabase callbacks:
     - `https://<dev-ref>.supabase.co/auth/v1/callback`
     - `https://<prod-ref>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**.
6. In **each** Supabase project: **Authentication → Sign In / Providers → Google**, turn it on and paste the client ID and secret.

### Supabase redirect URLs

In each project, **Authentication → URL Configuration**:

| Setting | Dev project | Prod project |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | `https://<project-name>.vercel.app` |
| Redirect URLs | `http://localhost:3000/**` and `https://*-<your-vercel-team-slug>.vercel.app/**` | `https://<project-name>.vercel.app/**` |

The wildcard line covers every Vercel preview URL. Your team slug is in your Vercel dashboard URL.

### Magic link email

In each project, **Authentication → Emails → Templates → Magic Link**:

- Subject: `Your sign-in link for Where It Used To Be`
- Body (placeholder copy, Canadian English):

```html
<h2>Sign in to Where It Used To Be</h2>
<p>Tap the link below to sign in. It works once and expires in an hour.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

Supabase's built-in email sender only allows a few emails an hour and is meant for testing. Before you invite testers, send through the game's own Gmail account (`whereitusedtobegame@gmail.com`) instead:

1. That Google account needs 2-Step Verification on. Then create an **App password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), named `Supabase`. Keep it in your password manager; never put it in `.env.local` or the repo.
2. In each Supabase project: **Authentication → Emails → SMTP Settings**, turn on custom SMTP:

| Field | Value |
| --- | --- |
| Sender email | `whereitusedtobegame@gmail.com` |
| Sender name | `Where It Used To Be` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `whereitusedtobegame@gmail.com` |
| Password | the app password |

3. Under **Authentication → Rate Limits**, raise the email limit to about 30 an hour.

Gmail allows about 500 emails a day, plenty for testing. If the game outgrows that, switch to a sending service; only these settings change.

## 12. Make yourself an admin (after you've signed in once)

Sign in on the site, then in the Supabase **SQL Editor** for that project run:

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'YOUR-EMAIL');
```

Admin rights are checked on the server for every admin route, and players can't change `is_admin` themselves (the database refuses).

## Environment variables

| Variable | Where | Secret? | What it is |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel | No | The Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel | No (safe in the browser; RLS protects data) | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | `.env.local`, Vercel | **Yes** | Supabase secret key. Server only, bypasses RLS |
| `SUPABASE_DEV_PROJECT_REF` | `.env.local` only | No | Used by `npm run db:*` scripts |
| `SUPABASE_PROD_PROJECT_REF` | `.env.local` only | No | Used by `npm run db:push:prod` |
| `SUPABASE_ACCESS_TOKEN` | `.env.local` only | **Yes** | Personal access token for the `npm run db:*` scripts |
| `SUPABASE_DEV_DB_PASSWORD` | `.env.local` only | **Yes** | Dev database password for the `npm run db:*` scripts |

Vercel sets `VERCEL_ENV` itself; the app uses it to tell production from previews.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app at <http://localhost:3000> against the dev database |
| `npm test` | Unit tests plus the database tests (an in-memory Postgres, no Docker or internet needed) |
| `npm run typecheck` | Type-check everything |
| `npm run db:push:dev` | Apply new migrations to dev |
| `npm run db:push:prod` | Apply new migrations to production (asks first) |
| `npm run db:fixtures` | (Re)load `TEST:` fixtures into dev |
| `npm run db:advisors` | Supabase's own security and performance checks, on dev |

## How rate limiting works

Guesses and submissions are counted in Postgres by `public.rate_limit_hit(key, window_seconds, max)`, which only the server can call. Limits live in `config/game.ts` under `rateLimits`. Sign-in emails are also capped by Supabase Auth's own limits (**Authentication → Rate Limits**). The routes that use these arrive in Milestones 2 to 4.
