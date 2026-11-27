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
2. **Google Auth Platform → Branding**: app name `Where It Used To Be`, your support email. Under **Authorized domains**, add each Supabase project's own domain, `igclemmromezcgmxucov.supabase.co` and `hutisipoyetsaclasqvb.supabase.co`. Plain `supabase.co` is refused, because Google treats it like `.com` (every project gets its own subdomain).
3. **Audience**: External. Publish the app when you're ready for anyone to sign in (until then only listed test users can).
4. **Clients → Create client**: type **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` and `https://where-it-used-to-be.vercel.app`.
   - Authorized redirect URIs: both Supabase callbacks:
     - `https://igclemmromezcgmxucov.supabase.co/auth/v1/callback`
     - `https://hutisipoyetsaclasqvb.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**.
6. In **each** Supabase project: **Authentication → Sign In / Providers → Google**, turn it on and paste the client ID and secret.

### Supabase redirect URLs

In each project, **Authentication → URL Configuration**:

| Setting | Dev project | Prod project |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | `https://where-it-used-to-be.vercel.app` |
| Redirect URLs | `http://localhost:3000/**` and `https://*-mike-davidsons-projects-6de86e83.vercel.app/**` | `https://where-it-used-to-be.vercel.app/**` |

The wildcard line covers every Vercel preview URL. Your team slug is in your Vercel dashboard URL.

### Sign-in emails

The link in the email must go straight to the app's `/auth/confirm` page with a one-time token, not through Supabase's default link. That way it works even when the player opens the email in a different browser (for example, a phone's mail app), and on every preview URL. The app puts `/auth/confirm?next=…` in `{{ .RedirectTo }}`, so the template adds the token after it with `&`.

Supabase only allows template changes once custom SMTP is on (free plan), so **set up Gmail sending below first**. Until then, the default email still signs players in, but only if they open the link in the same browser they asked from.

In each project, **Authentication → Emails → Templates**, change two templates.

**Magic Link** (players who already have an account):

- Subject: `Your sign-in link for Where It Used To Be`
- Body (placeholder copy, Canadian English):

```html
<h2>Sign in to Where It Used To Be</h2>
<p>Tap the link below to sign in. It works once and expires in an hour.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

**Confirm signup** (a player's first sign-in, which creates the account):

- Subject: `Your sign-in link for Where It Used To Be`
- Body: the same as above.

If the redirect URLs above don't include the address the player signed in from, Supabase falls back to the Site URL and the link won't work; the player sees "That sign-in link didn't work". Check the redirect URLs first if that happens.

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
| `npm run puzzles:generate` | Make daily puzzles in **dev** from today for 30 days (`-- 7` for a week), skipping days that have one. Refuses to run against production |

## Checking the era cards

Outside production, <http://localhost:3000/dev/era-cards> (and the same path on a preview URL) shows all six era card styles, full and mini, with a short and a very long name. In production that page doesn't exist.

## How rate limiting works

Guesses, sign-in emails, group actions and submissions are counted in Postgres by `public.rate_limit_hit(key, window_seconds, max)`, which only the server can call. Limits live in `config/game.ts` under `rateLimits`:

| What | Limit (default) | Counted by |
| --- | --- | --- |
| Guesses | 30 a minute | device |
| Sign-in emails | 5 an hour, and 3 an hour to any one address | IP address, and email address |
| Creating groups | 10 a day | player |
| Joining groups | 20 an hour | player |
| Submissions (Milestone 4) | 5 a day | player |

Sign-in emails are also capped by Supabase Auth's own limits (**Authentication → Rate Limits**).

## How accounts work

- Playing never needs an account. A guest's browser keeps a random device ID (local storage, plus a `wiutb_device` cookie so the server can see it at sign-in).
- On sign-in, `/auth/confirm` links the device to the account and moves its guest plays across. If the account already has a play for a day the device also played, the account's play is kept.
- Signing out gives the browser a new device ID, so whoever uses it next starts as a fresh guest.
- First sign-in asks for a display name (2 to 24 characters, unique ignoring case and spaces) and has an **unticked** box to get emails about the game. The choice and its time are stored in `profiles.marketing_opt_in` and `marketing_opt_in_at`, and players can change it in Profile. Nothing syncs to a mailing tool; export from the `profiles` table when you need a list.
- Delete account (in Profile) deletes the auth user; the database removes the profile, plays, group memberships and groups the player owns.
- To try sign-in locally without sending email, sign in once on <http://localhost:3000/sign-in> with your own address.
