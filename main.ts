import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSnapshot, buildRadar, boardIssue, dataScript } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  for (let i = 2; i < process.argv.length; i++) {
    const v = process.argv[i];
    if (v === `--${name}`) {
      return process.argv[i + 1] ?? fallback;
    }
    if (v.startsWith(prefix)) {
      return v.slice(prefix.length);
    }
  }
  return fallback;
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`input file not found: ${inputFile}\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

let snapshot;
try {
  snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
} catch (err: any) {
  process.stderr.write(String(err?.message ?? err) + '\n');
  process.exit(1);
}

const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue) {
  process.stderr.write(String(issue) + '\n');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), JSON.stringify({ rows: board }) + '\n');
writeFileSync(join(out, 'data.js'), dataScript(radar));

function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isFile()) continue;
    copyFileSync(join(from, entry.name), join(to, entry.name));
    names.push(entry.name);
  }
  return names;
}

const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`less than 3 screenshots: ${shots.length}\n`);
  process.exit(1);
}

const shotRegex = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
for (const name of shots) {
  if (!shotRegex.test(name)) {
    process.stderr.write(`invalid screenshot name: ${name}\n`);
    process.exit(1);
  }
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4194304 }
  })
);

const N = snapshot.protocols.length;
const M = snapshot.watchlist.length;
const K = board.length;
const E = radar.early_size;
const L = radar.live_size;
const S = shots.length;

console.log(`token radar: ${N} protocols, ${M} on the watchlist, ${K} rows scored (${E} early, ${L} live set aside)`);
console.log(`token radar: wrote ${out}/board.json, ${out}/data.js, ${out}/dashboard (${dashFiles.length} files), ${out}/screenshots (${S} images) and ${out}/dossier.json`);
