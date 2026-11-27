// MapLibre 6 runs its tile work in a separate worker file, which it normally finds
// next to its own module. Once bundled, that lookup fails, so copy the worker into
// public/ (versioned, for caching) and point MapLibre at it with setWorkerUrl.
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("node_modules/maplibre-gl/package.json", "utf8"));
const dir = "public/maplibre";
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) rmSync(`${dir}/${f}`);
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", `${dir}/worker-${version}.mjs`);
console.log(`MapLibre worker ${version} copied to ${dir}/`);
