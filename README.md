# Where It Used To Be

A free daily map game about the Saint John, New Brunswick businesses that are gone. Five rounds a day, the same for everyone, rolling over at midnight Atlantic Time.

- Product brief: [Where It Used To Be Claude Code MVP Prompt.md](Where%20It%20Used%20To%20Be%20Claude%20Code%20MVP%20Prompt.md)
- Setup and every environment variable: [SETUP.md](SETUP.md)
- Game settings: [config/game.ts](config/game.ts)

## Layout

| Path | What's there |
| --- | --- |
| `src/app` | Next.js App Router pages and route handlers |
| `src/lib` | Shared server and client code (puzzle date, Supabase clients) |
| `config/game.ts` | Every tunable value: scoring, verdicts, map, limits |
| `supabase/migrations` | Database schema and Row Level Security |
| `supabase/fixtures` | `TEST:` development data (dev database only) |
| `tests` | Database tests that run the migrations on an in-memory Postgres |

## Commands

```bash
npm run dev
```

```bash
npm test
```

More in [SETUP.md](SETUP.md#everyday-commands).
