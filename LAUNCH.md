# Launch checklist

Milestone 5 is done when every box is ticked and Mike signs off. Ticked items were checked on 2026-11-27; the rest are Mike's.

## Built and checked

- [x] **Share image.** Results → **Save image** makes a 1080 × 1080 PNG of the day's score and the five verdict colours (`/share-image`). It shows no place names, so it can't spoil the day for anyone. Phones get the share sheet (Save Image); computers download the file. The end-to-end test clicks it.
- [x] **Link preview.** Sharing the game's address shows a preview card (`opengraph-image`).
- [x] **Installable.** A web app manifest and icons, so **Add to Home Screen** opens the game full screen. No offline play, as the spec says.
- [x] **How to play, About, Privacy** pages, with placeholder copy, a verdict key on How to play, and the map credit (OpenStreetMap, OpenFreeMap, OpenMapTiles) on all three. Home links to them at the bottom.
- [x] **Accessibility.** axe (automated WCAG 2.1 A and AA) passes on every player page, a round, the reveal, results, all six era cards, and the signed-in and admin pages: `npm run test:e2e`. It found one problem, the grey "Played" pill on the admin calendar (4.1:1), now 6.7:1.
- [x] **Keyboard and screen readers.** Name rounds are buttons in a labelled group. Pin rounds: focus the map, arrow keys move it, Enter drops the pin at the centre (the end-to-end test plays pin rounds this way). Visible focus outlines, and reduced-motion settings are respected.
- [x] **Performance.** On a throttled mid-range phone over mobile data (`node scripts/perf-check.mjs`), the main content shows in about 0.8 s on Home and 2.2 s on the game. The map now loads only on screens that show it: Home was downloading MapLibre through link prefetching, and now downloads 171 KB of JavaScript instead of 455 KB. Era fonts load only when their card shows.
- [x] **End-to-end test.** `npm run test:e2e` plays a full day as a new guest at 390 px wide, from Home to Results, including Save image and checking for sideways scrolling.
- [x] **Security.** Row Level Security on every table; the server key is used only on the server; admin rights are checked on the server; rate limits on guesses, sign-in emails, suggestions and groups (SETUP.md); photo location data stripped.
- [x] **No `TEST:` data in production.** Production refuses `TEST:` names, and its 125 places include none.
- [x] **Production is running.** `/api/health` reports the database connected and the puzzle date in Moncton time. Google and email sign-in work on the live address.
- [x] **All tests pass**: 141 unit and database tests (`npm test`) and 12 browser tests (`npm run test:e2e`).

## Mike's to do before launch

- [ ] **Places.** Pin the 71 drafts that need it, check the 54 "check pin" ones, verify, and **Make live**. Production has 0 live places today. Five live places on different sites make one day; about 150 last 30 days without repeats.
- [ ] **Puzzles.** Admin → Puzzles → **Generate**, then **Preview as player** for the first few days.
- [ ] **Play the live game** on your phone from the home screen icon: a full day, Share, Save image.
- [ ] **Placeholder copy:** How to play, About and Privacy text, and the verdict labels (`config/game.ts`).
- [ ] **Artwork:** the app icon and share image. To replace them, swap the PNGs in `public/icons/` and `src/app/icon.png` / `apple-icon.png`, or send them to Claude; the share card and link preview are in `src/app/share-image/route.tsx` and `src/app/opengraph-image.tsx`.
- [ ] **Scoring thresholds** after playtesting (`config/game.ts`).
- [ ] **Google sign-in for everyone.** In Google Cloud → Google Auth Platform → Audience, the app must be **In production**, not Testing, or only listed test users can sign in.
- [ ] **Sign-off.**

## Later (out of scope for the MVP)

Custom domain and ads, Sign in with Apple and app store builds, practice mode and past days, multi-business sites and guess-the-year rounds, party mode, areas beyond Saint John, more era cards, reminder emails.
