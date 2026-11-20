// Vice Coast Cover Studio — entrypoint for make.fun's gta6-cover-art-01.
// Node 22, standard library only. The grader runs this file twice in a fresh
// container with no network: it must write the same bytes both times.
//
// The app itself is plain static files under app/ (index.html plus ES
// modules, fonts and sample photos, no build step, no network request), and
// screenshots/ holds the 3-4 screenshots its maker took. This program copies
// both into the output directory and writes dossier.json — the summary the
// judge reads — with the kit's vendored library, vendor/makefun-app.ts.
//
// Local run (outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Try the app first with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps for this bounty (screenshots: at most 4, each at most
// 256 KiB; app/: at most 993 files, 48 MiB in all, paths at most 1000 bytes;
// the dossier's source text at most 160 KiB). buildDossier refuses an entry
// the scorer would refuse, so a local run that succeeds here is shippable.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyIntoOutput(name: string): void {
  const source = join(repoRoot, name);
  const target = join(outDir, name);
  mkdirSync(target, { recursive: true });
  if (existsSync(source)) cpSync(source, target, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyIntoOutput('app');
copyIntoOutput('screenshots');

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER_CAPS));
