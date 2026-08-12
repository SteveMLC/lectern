#!/usr/bin/env node
/**
 * Give the demo speakers real faces.
 *
 * Headshots are R2 objects plus a speaker_assets row — exactly what a speaker
 * upload produces — so what a judge sees in the gallery went through the same
 * path a real upload does. Nothing here is a special case in the product.
 *
 * Runs chained after the D1 seed (see db:seed:local / db:seed:remote), because
 * the seed wipes speaker_assets and only this script knows each file's real
 * byte size. Safe to run repeatedly, and safe to run with no images at all:
 * with the directory empty, every surface falls back to initials tiles rather
 * than rendering broken images.
 *
 *   node scripts/seed-headshots.mjs --local
 *   node scripts/seed-headshots.mjs --remote
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname, basename } from "node:path";

const remote = process.argv.includes("--remote");
const scope = remote ? "--remote" : "--local";
const headshotDir = new URL("../seed/headshots/", import.meta.url).pathname;
const bucket = "lectern-assets";
const database = "lectern-db";

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
}

if (!existsSync(headshotDir)) {
  console.log("seed-headshots: no seed/headshots directory — speakers keep their initials tiles.");
  process.exit(0);
}

// Filenames are the speaker id: spk_ada.jpg -> spk_ada.
const files = readdirSync(headshotDir)
  .filter((name) => CONTENT_TYPES[extname(name).toLowerCase()])
  .sort();

if (files.length === 0) {
  console.log("seed-headshots: no images found — speakers keep their initials tiles.");
  process.exit(0);
}

const rows = [];
for (const file of files) {
  const speakerId = basename(file, extname(file));
  const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
  const path = join(headshotDir, file);
  const sizeBytes = readFileSync(path).byteLength;
  const r2Key = `speakers/${speakerId}/seed/headshot${extname(file).toLowerCase()}`;

  console.log(`seed-headshots: uploading ${file} -> ${r2Key} (${sizeBytes} bytes)`);
  run("npx", [
    "wrangler",
    "r2",
    "object",
    "put",
    `${bucket}/${r2Key}`,
    scope,
    "--file",
    path,
    "--content-type",
    contentType,
    "--force",
  ]);

  rows.push({
    id: `asset_seed_${speakerId.replace(/^spk_/, "")}`,
    speakerId,
    filename: `${speakerId}-headshot${extname(file).toLowerCase()}`,
    contentType,
    sizeBytes,
    r2Key,
  });
}

// One statement per row, guarded on the speaker existing so a stray image
// file can never break the seed.
const sql = rows
  .map(
    (row) =>
      `INSERT INTO speaker_assets (id, speaker_id, kind, filename, content_type, size_bytes, r2_key, uploaded_at)
       SELECT '${row.id}', '${row.speakerId}', 'headshot', '${row.filename}', '${row.contentType}', ${row.sizeBytes}, '${row.r2Key}', '2026-08-02T12:00:00Z'
       WHERE EXISTS (SELECT 1 FROM speakers WHERE id = '${row.speakerId}')
       ON CONFLICT(id) DO UPDATE SET
         size_bytes = excluded.size_bytes,
         content_type = excluded.content_type,
         r2_key = excluded.r2_key;`,
  )
  .join("\n");

const tmpFile = join(headshotDir, ".seed-headshots.generated.sql");
writeFileSync(tmpFile, sql);
try {
  run("npx", ["wrangler", "d1", "execute", database, scope, "--file", tmpFile]);
} finally {
  unlinkSync(tmpFile);
}

console.log(`seed-headshots: ${rows.length} headshot(s) seeded ${remote ? "remotely" : "locally"}.`);
