#!/usr/bin/env node
// Database helper for the two Supabase projects. Reads settings from .env.local.
//
//   npm run db:push:dev      push migrations to the dev project
//   npm run db:push:prod     push migrations to the production project (asks first)
//   npm run db:fixtures      load TEST: fixtures into the dev project only
//   npm run db:advisors      run Supabase's security and performance checks on dev
//
// Signs in with SUPABASE_ACCESS_TOKEN (a personal access token) instead of the
// browser login. The dev database password comes from .env.local; the production
// password is typed in each time and never stored. See SETUP.md.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PROD = process.env.SUPABASE_PROD_PROJECT_REF;

function need(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env.local. See SETUP.md.`);
    process.exit(1);
  }
  return value;
}

/** Runs the Supabase CLI non-interactively with the token and the given DB password. */
function supabase(args, dbPassword) {
  const env = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: need("SUPABASE_ACCESS_TOKEN"),
    SUPABASE_YES: "1",
  };
  if (dbPassword) env.SUPABASE_DB_PASSWORD = dbPassword;
  const r = spawnSync("npx", ["supabase", ...args, "--yes"], { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Reads typed lines one at a time; hidden questions don't echo what's typed.
let rl;
let lines;
let muted = false;
async function ask(question, { hidden = false } = {}) {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: new Writable({
        write(chunk, _enc, done) {
          if (!muted) process.stdout.write(chunk);
          done();
        },
      }),
      terminal: true,
    });
    lines = rl[Symbol.asyncIterator]();
  }
  process.stdout.write(question);
  muted = hidden;
  const { value = "" } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write("\n");
  return value.trim();
}

const command = process.argv[2];

switch (command) {
  case "push:dev":
    supabase(["db", "push", `--remote=${need("SUPABASE_DEV_PROJECT_REF")}`], need("SUPABASE_DEV_DB_PASSWORD"));
    break;

  case "push:prod": {
    const ref = need("SUPABASE_PROD_PROJECT_REF");
    const confirm = await ask(`Push migrations to PRODUCTION (${ref})? Type "production" to continue: `);
    if (confirm !== "production") {
      rl.close();
      console.log("Cancelled.");
      process.exit(1);
    }
    const password = await ask("Production database password (not shown): ", { hidden: true });
    rl.close();
    if (!password) {
      console.log("Cancelled.");
      process.exit(1);
    }
    supabase(["db", "push", `--remote=${ref}`], password);
    break;
  }

  case "fixtures": {
    const ref = need("SUPABASE_DEV_PROJECT_REF");
    if (PROD && ref === PROD) {
      console.error("SUPABASE_DEV_PROJECT_REF matches the production ref. Refusing to load TEST: fixtures.");
      process.exit(1);
    }
    // The SQL file also refuses to run unless the database says it is 'development'.
    supabase(
      ["db", "query", `--remote=${ref}`, "-f", "supabase/fixtures/dev_fixtures.sql"],
      need("SUPABASE_DEV_DB_PASSWORD"),
    );
    break;
  }

  case "advisors":
    supabase(["db", "advisors", `--remote=${need("SUPABASE_DEV_PROJECT_REF")}`, "--type", "all"], need("SUPABASE_DEV_DB_PASSWORD"));
    break;

  default:
    console.error("Usage: node scripts/db.mjs <push:dev | push:prod | fixtures | advisors>");
    process.exit(1);
}
