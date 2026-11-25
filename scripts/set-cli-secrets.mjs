#!/usr/bin/env node
// Asks for the Supabase access token, the DEV database password and the DEV secret key
// (typing is hidden; press Enter to keep a value)
// and writes them into .env.local. Nothing is printed or sent anywhere.
//
//   npm run env:cli-secrets
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const FILE = ".env.local";

// Reads typed lines one at a time (works for typing and for piped input), echo hidden.
let muted = false;
const output = new Writable({
  write(chunk, _enc, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
const lines = rl[Symbol.asyncIterator]();

async function askHidden(question) {
  process.stdout.write(question);
  muted = true;
  const { value = "" } = await lines.next();
  muted = false;
  process.stdout.write("\n");
  return value.trim();
}

function setLine(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`;
}

let text = readFileSync(FILE, "utf8");

const token = await askHidden("Supabase access token (starts sbp_, not shown): ");
if (token) text = setLine(text, "SUPABASE_ACCESS_TOKEN", token);

const password = await askHidden("DEV database password (not shown): ");
if (password) {
  // Quote it so characters like # or spaces survive .env parsing.
  const quoted = password.includes("'") ? `"${password}"` : `'${password}'`;
  text = setLine(text, "SUPABASE_DEV_DB_PASSWORD", quoted);
}

const secretKey = await askHidden("DEV secret key, starts sb_secret_ (press Enter to keep the current one): ");
if (secretKey) text = setLine(text, "SUPABASE_SECRET_KEY", secretKey);

rl.close();
writeFileSync(FILE, text);
const said = (v) => (v ? "set" : "unchanged");
console.log(
  `Saved to ${FILE}: token ${said(token)}, dev password ${said(password)}, dev secret key ${said(secretKey)}.`,
);
