# Where It Used To Be: Claude Code MVP Prompt

Nov 25, 2026 · @Mike

## How to use this prompt

Paste everything below this section into Claude Code in an empty folder. It builds the MVP in five milestones and stops after each one for Mike to test. Values marked **(default)** are starting points Mike can change later in a config file.

## Brief

You are building **Where It Used To Be**, a free daily map game for Saint John, New Brunswick. Each day, every player gets the same five rounds about businesses that are gone. In some rounds they drop a pin where a former business used to be. In others they're shown a spot (and what's there now) and pick what used to be there. After each guess, the answer appears as an **era card**: a card styled after the decade that place is remembered from. The game is modelled on daily pin-drop geography games like PlayPinDrop, but about the past, not the present. It launches as a mobile-first web app on a free `vercel.app` address, targeting **December 17, 2026**, with app store versions later.

The owner is Mike Davidson, a designer. Write all user-facing copy in Canadian English (colour, neighbourhood, centre).

## Hard rules

These override anything else in this prompt.

1. **Same puzzle for everyone.** The daily puzzle is identical for all players and rolls over at midnight in `America/Moncton` (New Brunswick, Atlantic Time). Never use the server's or the browser's time zone to decide the puzzle date.
2. **Answers stay on the server.** Never send a round's answer (coordinates for pin rounds, the correct choice for name rounds) to the browser before the player has submitted that round. Score every round on the server.
3. **Street names only on the map.** Show streets and street names. Hide every business, point-of-interest, shop, transit, place-name and house-number label, because they would give answers away.
4. **Businesses and public places only.** Never store or show private homes or private individuals. Moderation must reject submissions that point at a private residence or name a private person.
5. **Era cards evoke a decade, never a brand.** No real company's logo, wordmark, signature colours or sign design. Names appear as plain text in the card's decade style.
6. **No third-party comedy material.** Don't reference any comedian's name, routines or jokes anywhere in the app or its copy.
7. **No ads at launch.** Leave room in the layout for an ad slot behind a config flag that is off by default.
8. **No invented content in production.** Development fixtures must be clearly fake (names start with `TEST:`) and must never be seeded into the production database.
9. **Ask before guessing.** If something here is ambiguous, ask Mike instead of assuming. Check current library docs before using an API you aren't sure of.

## Tech stack and architecture

Use current stable versions and check each library's docs before writing code against it.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router) with TypeScript | Server route handlers for all scoring and writes |
| Styling | Tailwind CSS | Design tokens from the Visual direction section |
| Database, auth, storage | Supabase (Postgres, Auth, Storage) | Row Level Security on every table |
| Sign-in | Google and email magic link, through Supabase Auth | No Apple sign-in in the MVP |
| Map | MapLibre GL JS with OpenFreeMap vector tiles | Free, no API key. Build a custom style from an OpenFreeMap base style that keeps road names and removes every other label. Show the attribution OpenStreetMap and OpenFreeMap require |
| Hosting | Vercel, on the free `vercel.app` address | Production and preview deployments |
| Share images | Next.js image generation (`ImageResponse`) | Results card for social sharing |
| Fonts | `next/font` with Google Fonts | Inter for the app; era card fonts listed in Visual direction |

**Architecture rules**

- The browser asks the server for today's puzzle and receives only what each round needs to be played: for pin rounds, the business name, category and era; for name rounds, the site's coordinates, what's there now and four choices in random order.
- The browser submits each guess to a route handler. The server checks the round, computes distance and points, stores the result, and only then returns the answer, the era card data and the fact.
- Guests can play. Their results are stored server-side against an anonymous device ID kept in local storage, so scoring is still server-side. When a guest signs in, link that device's results to the account.
- All config values marked (default) live in one typed config file, `config/game.ts`.
- Map bounds and the starting view are config values. Start centred on Uptown Saint John at about 45.271, -66.062, and set bounds that cover the City of Saint John.

## Data model

One **site** (a spot on the map) can hold several former **places** over time. The MVP uses one place per round, but this shape lets a later version ask about several generations of businesses at the same site.

| Table | Key fields | Notes |
| --- | --- | --- |
| `profiles` | `id` (auth user), `display_name`, `is_admin`, `current_streak`, `best_streak`, `created_at` | Display name 2 to 24 characters, shown on leaderboards |
| `devices` | `id` (random UUID in local storage), `user_id` (nullable), `created_at` | Lets guests play and links their history on sign-in |
| `sites` | `id`, `lat`, `lng`, `address_text`, `neighbourhood`, `current_use`, `notes`, timestamps | `current_use` is what's there now, for example "Popeyes" |
| `places` | `id`, `site_id`, `name`, `category`, `year_opened`, `year_closed`, `era`, `fact`, `sources`, `photo_path`, `photo_rights_confirmed`, `difficulty`, `status`, `verified_at`, `last_used_on`, `created_by`, timestamps | A former business. `era`: 1970s, 1980s, 1990s, 2000s, 2010s or empty. `fact`: one line, 160 characters max. `sources`: list of label and URL. `difficulty`: 1 to 3. `status`: draft, live or retired |
| `daily_puzzles` | `puzzle_date` (primary key), `number`, `rounds`, `locked`, `created_at` | `rounds`: five entries of place, mode (pin or name), and for name rounds the three wrong-answer place IDs. Locked once its date starts |
| `plays` | `id`, `puzzle_date`, `user_id`, `device_id`, `started_at`, `completed_at`, `total_points` | One play per user per date, and one per device per date |
| `play_rounds` | `play_id`, `round_index`, `mode`, `guess_lat`, `guess_lng`, `choice_place_id`, `distance_m`, `points` | One row per round; no resubmits |
| `groups` | `id`, `name`, `invite_code`, `owner_id`, `created_at` | Invite code: random, 8 characters, unique |
| `group_members` | `group_id`, `user_id`, `joined_at` |  |
| `submissions` | `id`, `user_id`, `business_name`, `category`, `lat`, `lng`, `address_text`, `current_use`, `years_text`, `era`, `memory`, `photo_path`, `photo_rights_confirmed`, `status`, `admin_note`, `place_id`, `created_at`, `reviewed_at` | `status`: pending, approved or rejected |

**Rules**

- A place can only go `live` if it has coordinates (through its site), a `verified_at` date, a category and a difficulty. Only live places can be scheduled.
- Row Level Security: players read only their own plays and rounds; leaderboards come from server queries or views that expose display names and totals only; places, sites and puzzles are readable only through the server routes; only admins write places, sites, puzzles and submission reviews.
- Photos go in a private Supabase Storage bucket and are served through signed URLs.

## Game rules and scoring

A day is five rounds worth up to 200 points each, 1,000 in total. No timer. Each round is final once submitted.

**Round types**

- **Pin it.** The card shows the former business name, its category and "Pin where it used to be." The player taps the map to drop a pin, can drag it, then presses Lock it in.
- **Name it.** The map shows a pin on a site, with "Now: \[current use\]" and "What used to be here?" The player picks one of four names: the right place plus three wrong ones. Prefer wrong answers from the same category and era so the choice is hard. Never use a place from the same site as a wrong answer.

**Daily mix (default):** Pin, Name, Pin, Name, Pin. Order rounds from easy to hard by `difficulty`.

**Pin scoring (default)**

| Distance from the site | Points |
| --- | --- |
| 50 m or less | 200 |
| 50 m to 500 m | Falls in a straight line from 200 to 100 |
| 500 m to 5 km | Falls in a straight line from 100 to 0 |
| Over 5 km | 0 |

Distance is the great-circle distance between the pin and the site, computed on the server. Round to whole points.

**Name scoring (default):** right answer 200, wrong answer 0.

**Verdict labels (default copy, Mike will replace):**

| Points | Label |
| --- | --- |
| 180 to 200 | Lifer! |
| 120 to 179 | Knows the spot |
| 60 to 119 | Close-ish |
| 1 to 59 | From away... |
| 0 | Who? |

**Scheduling rules (default)**

- The admin area generates puzzles 30 days ahead from live places. Mike can swap any round before its date starts.
- Pick the least recently used live places first, so no place repeats until the whole pool has been used. At five a day, 150 live places last 30 days. Show the admin how many days of unused places are left.
- No two rounds in a day share a site.
- If no puzzle exists for a date, the app shows a friendly "No puzzle today" screen and logs an error for the admin.

## Player screens and flows

Design for a 390 px wide phone first; it must also work on desktop.

1. **Home.** Game name, Day # and date, a Play button (or See today's results once played), current streak, countdown to the next puzzle, and links to How to play, Leaderboard, Groups, Suggest a place, and Sign in or Profile.
2. **Round.** A full-screen map. Top: two small cards for Day # and Round x/5, and the running score. Bottom card: the round prompt.
   - Pin rounds: business name, category tag, "Pin where it used to be." After a tap, show the pin, a clear button and Lock it in.
   - Name rounds: a site marker on the map, "Now: \[current use\]", "What used to be here?" and four choice buttons.
3. **Reveal.** A bottom sheet slides up over the map.
   - Map: the player's pin, the real site, a dashed line between them and a 50 m circle around the site (pin rounds only).
   - Sheet: the **era card** for the place (see Visual direction), a verdict chip, the distance (pin rounds) or Right/Wrong (name rounds), points this round, running total, the one-line fact with a small Sources link, and Next round (See results after round 5).
4. **Results.** Score out of 1,000, a progress bar, five round dots coloured by verdict, streak, countdown, Share, and a "Today's places" recap with a mini era card and fact for each round. Signed-in players see their rank today; guests see a prompt to sign in to appear on the leaderboard.
5. **Leaderboard.** Tabs for Today (everyone) and each of the player's groups. Top 50 plus the player's own row. Ties: earlier finish time ranks higher.
6. **Groups.** Create a group, copy its invite link, join through `/join/[code]`, leave a group. Group boards show today and the last 7 days. Members can't see other members' rounds until they've played today.
7. **Sign in.** Google or email link. On first sign-in, ask for a display name.
8. **Profile.** Edit display name, current and best streak, past results by date, sign out, and Delete account (removes the profile, plays and group memberships).
9. **Suggest a place.** Signed-in players only (see Submissions).
10. **How to play, About, Privacy.** Static pages with placeholder copy for Mike, plus map attribution.

**Share text format**

```
Where It Used To Be #12 · 742/1000
🟩🟨🟧🟩🟥
[app URL]
```

One emoji per round by verdict: Lifer! 🟩, Knows the spot 🟨, Close-ish 🟧, From away... 🟥, Who? ⬛. Use the Web Share API where available and fall back to copy-to-clipboard. Also offer Save image, which renders the results card through `ImageResponse`.

## Visual direction

The app itself is modern, calm and clean. The character lives in one component, the era card, which changes style with the decade a place is remembered from. If Mike attaches PNG exports of his mockups, match them; these specs come from them.

**App chrome tokens**

| Token | Value |
| --- | --- |
| Background | #EEF2F4 |
| Surface (cards, sheet) | #FFFFFF |
| Ink (headings, primary button) | #12324A |
| Secondary text | #5C7182 |
| Body text | #3B5163 |
| Dividers | #D3DCE2, #E3E9ED |
| Accent (real-site pin, circle, progress) | #B5452F |
| Player pin | #12324A |
| Verdict chip | Background #F8E6D8, text #8A3E14 |
| Map | Land #EEF2F4, roads #FFFFFF, parks #D5E6D3, water #BFD6E3, road labels #5C7182 in Inter 11 px |
| Type | Inter 400, 500, 600, 700. Score 42 px bold; body 14 to 15 px; labels 11 to 12 px semibold uppercase with letter spacing |
| Shape | Cards 14 px radius; bottom sheet 24 px top corners; chips fully rounded; buttons 52 px tall, 14 px radius |
| Shadow | Cards 0 1px 3px rgba(18,50,74,0.12); sheet 0 -4px 20px rgba(18,50,74,0.10) |
| Icons | Simple stroke icons; no emoji in the interface |

**Era card anatomy**

- One card, 14 px radius, clipped. The top **panel** carries the era style and the place name. Under the name, "Closed \[year\]" in the era's meta colour when `year_closed` is known.
- The bottom **Now bar** is the same in every era: white, 1 px #E3E9ED border, a "NOW" tag (navy background, white 11 px bold letter-spaced text, 4 px radius), then "\[current use\] · \[street\]" in 15 px semibold navy.
- A mini version (name and era only) is used in the results recap.
- Long names never truncate: shrink the font down to a 20 px minimum, then wrap to two lines.

**Era styles**

| Era | Panel | Name type | Name colour | Meta colour | Details |
| --- | --- | --- | --- | --- | --- |
| 1970s | #4E3220 | Shrikhand, 34 px | #F6E7C8 | #E8A33D | Three 6 px stripes across the top: #E8A33D, #D9692B, #A8322A |
| 1980s | #141018 | Bungee, uppercase | #FF6FB5 with glow 0 0 10px rgba(255,111,181,0.7) | #3FE0D0 | 4 px bottom rule in #3FE0D0 |
| 1990s | #3B2A6B | Righteous | #FFE45C | #FFFFFF | A teal squiggle (#2FC6B6) and a magenta dot (#FF5DA2) as decoration |
| 2000s | #1F5FBF | Exo 2, 800 italic | #FFFFFF | #CFE2FF | Gloss band: the top 34 px at rgba(255,255,255,0.16) |
| 2010s | #F7F5F0 with a 1 px #DAD6CC border | Montserrat 500, uppercase, 4 px letter spacing | #2B2B2B | #4E6B5E | A small #7FBFA4 dot before the meta text |
| No era set (fallback) | Brick #8E3A2A with mortar lines: horizontal rgba(0,0,0,0.18) 2 px every 22 px, vertical rgba(0,0,0,0.12) 2 px every 46 px | Alfa Slab One, uppercase | #F3E6CF at 62% opacity, like a faded painted sign | #F3E6CF at 80% | "USED TO BE" label above the name |

Places from the 1960s or earlier, or the 2020s, use the fallback card until those eras are designed. Check every era's meta text against its panel for WCAG AA contrast and adjust the shade if one fails; tell Mike what you changed.

## Accounts, streaks, leaderboards and groups

Playing never requires an account. Signing in adds the leaderboard, groups, submissions, and history across devices.

- **Sign-in:** Google and email magic link through Supabase Auth. List the exact setup steps Mike must do himself (Google Cloud OAuth client, Supabase redirect URLs for production and preview, email template), and every environment variable, in `SETUP.md`.
- **Guest to account:** on sign-in, attach the device's plays to the account. If the account already has a play for a date that the device also played, keep the account's.
- **Streak:** the number of consecutive puzzle dates with a completed play, ending today or yesterday. Track current and best. Guests see their device streak.
- **Public leaderboard:** today only, signed-in players with a completed play. Shows rank, display name and total. Guests don't appear.
- **Groups:** any signed-in player can create one (name up to 40 characters), share the invite link and see a board for today and the last 7 days. Members can leave; the owner can rename it, regenerate the invite code and remove members.
- **Fair play:** one play per account per date, rounds are final, scores come only from the server, and rate-limit the guess and submission endpoints.

## Submissions, moderation and the admin area

Nothing a player submits appears in the game until Mike approves it.

**Suggest a place (signed-in players)**

- Required: business name, category, a pin on the map, and a checkbox confirming it was a business or public place, not someone's home.
- Optional: address or nearest intersection, what's there now, roughly when it was open (free text, for example "late 80s to 2005"), decade, a memory (500 characters), and a photo (JPG or PNG, 5 MB max). A photo requires a second checkbox: "I took this photo or have permission to share it."
- Limit: 5 submissions per player per day.
- After sending: a thank-you screen; the player's Profile lists their submissions with status.

**Admin area (`/admin`, admins only)**

- **Dashboard:** live places, drafts, pending submissions, days of unused places left, and the status of the next 7 puzzles.
- **Places:** search and filters (status, era, category, missing coordinates, fact or source). The edit form has a map to drag the site pin, site fields, place fields, a sources editor, a live era card preview, and Mark verified and Make live buttons that check the rules in Data model.
- **Submissions queue:** oldest first, with a map preview. Approve creates a draft place prefilled from the submission; if an existing site is within 30 m, offer to attach it there. Reject with a note, or mark as a duplicate of an existing place.
- **Puzzles:** a 30-day calendar, a Generate button, a per-day editor to swap a place, change a round's mode or re-roll wrong answers, and a Preview as player button.
- **Import and export:** CSV, described in the next section.
- Document in `SETUP.md` how Mike makes his own account an admin.

## Seed data and CSV import

Production starts empty. Mike fills it by importing a CSV starter list he has checked, then through the admin area and approved submissions.

**CSV columns** (UTF-8, header row, one row per former business):

| Column | Required | Format |
| --- | --- | --- |
| `name` | Yes | Business name as people remember it |
| `category` | Yes | restaurant, bar, retail, grocery, entertainment, service, automotive or other |
| `address_text` | No | Address or nearest intersection |
| `lat`, `lng` | No | Decimal degrees |
| `current_use` | No | What's there now |
| `neighbourhood` | No | Free text |
| `year_opened`, `year_closed` | No | Four-digit years |
| `era` | No | 1970s, 1980s, 1990s, 2000s, 2010s, or blank for the fallback card |
| `fact` | No | One line, 160 characters max |
| `difficulty` | No | 1, 2 or 3 |
| `source_1_label`, `source_1_url` to `source_3_label`, `source_3_url` | No | Up to three sources |
| `notes` | No | Admin-only notes |

**Import behaviour**

- Always show a dry-run preview first, with errors per row, before anything is written.
- Every imported row becomes a draft. Rows without coordinates are flagged "needs pin" for Mike to place on the map. Don't geocode addresses automatically.
- If a row's coordinates fall within 30 m of an existing site, offer to attach it to that site.
- Export writes the same columns, so the file round-trips.
- Include a sample CSV in the repo with three `TEST:` rows.

## Quality bar

**Security and privacy**

- Row Level Security on every table. The Supabase service key is used only on the server.
- Validate every request body on the server. Check admin rights on the server for every admin route, not just in the interface.
- Rate-limit guesses, sign-in emails and submissions, and document how.
- Strip location and other metadata from uploaded photos before storing them.
- Collect only what the game needs. Delete account removes the player's data.

**Accessibility**

- WCAG 2.1 AA contrast, real buttons and form labels, visible focus states, and respect for reduced-motion settings.
- Name rounds work fully by keyboard and screen reader. Pin rounds offer a keyboard option: arrow keys move a crosshair, Enter drops the pin.

**Performance**

- Mobile-first and fast on a mid-range phone over mobile data. Load the map only on the round screen, and load each era font only when its card is shown.
- Installable as a web app (manifest and icons; Mike will supply final icons). Offline play isn't required.

**Testing**

- Unit tests: pin scoring at 0, 50, 500, 5,000 and 6,000 m; the puzzle date in `America/Moncton` around midnight and on daylight-saving change days; scheduler rules; CSV parsing and validation.
- Integration tests: no round answer reaches the browser before its guess; one play per account or device per date.
- One end-to-end test that plays a full day at phone size.

## Milestones

Build in this order. After each milestone, stop and report what you built, how Mike can test it (URLs and steps), and any open questions. Don't start the next one until he says go.

1. **Foundation.** Next.js app with Tailwind tokens, Supabase schema and RLS as migrations, `config/game.ts`, `SETUP.md`, `TEST:` fixtures for development, and a preview deployment on Vercel.
   - Done when: the app deploys to a `vercel.app` URL, migrations run cleanly on a fresh database, and `SETUP.md` lists every step and environment variable Mike needs.
2. **Core game for guests.** Home, puzzle API, both round types, server scoring, the reveal with all six era card styles, results, share text, device streak, and the puzzle generator.
   - Done when: a full day plays end to end at phone size, the answer-leak test passes, the scoring and time zone tests pass, and every era card matches the Visual direction specs.
3. **Accounts and social.** Google and email sign-in, display name, linking guest plays, Profile and history, the public leaderboard, and groups.
   - Done when: both sign-in methods work on the deployed URL, a guest's plays carry over on sign-in, and a second account can join a group through its invite link.
4. **Admin and submissions.** Admin dashboard, place editing with the map, CSV import and export, the puzzle calendar, the submissions queue and photo uploads.
   - Done when: Mike can import a CSV, pin the flagged drafts, make places live, generate 30 days of puzzles, and approve a test submission into a draft.
5. **Launch polish.** Share image, installable web app, How to play, About and Privacy pages with placeholder copy, an accessibility pass, a performance pass, the end-to-end test, and a launch checklist.
   - Done when: every checklist item is ticked and Mike signs off.

## Out of scope for the MVP

Don't build these yet, but don't design anything that blocks them:

- A custom domain and Google AdSense ads
- Sign in with Apple, and App Store and Google Play builds
- Practice mode and playing past days
- Rounds about several past businesses at one site, and guess-the-year rounds
- Live party mode and streak protection
- Areas beyond the City of Saint John
- Era cards for the 1960s and earlier, and the 2020s
- Daily reminder emails and push notifications

## Placeholders Mike will fill

- Verdict label copy
- How to play, About and Privacy page text
- App icon and share image artwork
- Scoring thresholds, after playtesting
