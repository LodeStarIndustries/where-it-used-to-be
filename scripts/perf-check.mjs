#!/usr/bin/env node
// Performance check: loads key pages like a mid-range phone on mobile data and
// reports what each downloads and when the main content appears.
//
//   npm run build && npx next start -p 3100
//   node scripts/perf-check.mjs http://localhost:3100
//
// Throttling matches Lighthouse's mobile preset (about 1.6 Mbps down, 150 ms
// latency, a 4x slower CPU).
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const pages = ["/", "/how-to-play", "/leaderboard", "/play"];

const browser = await chromium.launch();
const rows = [];
for (const path of pages) {
  const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const sizes = { js: 0, css: 0, font: 0, image: 0, other: 0 };
  const notable = new Set();
  const byRequest = new Map();
  cdp.on("Network.responseReceived", (e) => byRequest.set(e.requestId, e.response));
  cdp.on("Network.loadingFinished", (e) => {
    const r = byRequest.get(e.requestId);
    if (!r) return;
    const type = r.mimeType.includes("javascript")
      ? "js"
      : r.mimeType.includes("css")
        ? "css"
        : r.mimeType.includes("font") || /\.woff2?$/.test(r.url)
          ? "font"
          : r.mimeType.startsWith("image/")
            ? "image"
            : "other";
    sizes[type] += e.encodedDataLength;
    if (/maplibre|tiles\.openfreemap|\.pbf/.test(r.url)) notable.add("map");
    if (type === "font") notable.add("font:" + r.url.split("/").pop().slice(0, 24));
  });

  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const t0 = Date.now();
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 120_000 });
  const loaded = Date.now() - t0;
  const lcp = await page.evaluate(() => window.__lcp);
  const kb = (n) => Math.round(n / 1024);
  rows.push({
    page: path,
    "LCP s": (lcp / 1000).toFixed(1),
    "idle s": (loaded / 1000).toFixed(1),
    "JS KB": kb(sizes.js),
    "CSS KB": kb(sizes.css),
    "font KB": kb(sizes.font),
    "image KB": kb(sizes.image),
    map: notable.has("map") ? "yes" : "no",
  });
  await context.close();
}
await browser.close();
console.table(rows);
